import type { sheets_v4 } from "googleapis";
import type { GameSheetSections } from "./sheet-layout";

// Greyscale scheme, deliberately departing from the real spreadsheet's
// teal/pink palette per Connor's preference: grey highlights the infield
// (1st/2nd/3rd/Float) among the fielding positions and female players in
// the batting order, white everywhere else, to make both easy to track at
// a glance during a game.
const WHITE_FILL: sheets_v4.Schema$Color = { red: 1, green: 1, blue: 1 };
const GREY_FILL: sheets_v4.Schema$Color = { red: 0.851, green: 0.851, blue: 0.851 };
const GREY_FIELDING_POSITIONS = new Set(["1st", "2nd", "3rd", "Float"]);
const GREY_BATTING_GENDER = "F";
const THIN_BORDER_STYLE = "SOLID";

const thinBorder: sheets_v4.Schema$Border = { style: THIN_BORDER_STYLE };
const allSidesThin: sheets_v4.Schema$Borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

const CELL_FORMAT_FIELDS = "userEnteredFormat(backgroundColor,textFormat.bold,borders)";

/**
 * Collapses a set of (row, isGrey) pairs into contiguous same-color runs,
 * so adjacent rows sharing a format become one repeatCell request instead
 * of one per row.
 */
function greyRuns(rows: { rowIndex: number; grey: boolean }[]): { start: number; end: number; grey: boolean }[] {
  const sorted = [...rows].sort((a, b) => a.rowIndex - b.rowIndex);
  const runs: { start: number; end: number; grey: boolean }[] = [];
  for (const { rowIndex, grey } of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.grey === grey && last.end + 1 === rowIndex) {
      last.end = rowIndex;
    } else {
      runs.push({ start: rowIndex, end: rowIndex, grey });
    }
  }
  return runs;
}

function repeatCellRequest(
  sheetId: number,
  range: { startRow: number; endRow: number; columnCount: number },
  format: sheets_v4.Schema$CellFormat,
): sheets_v4.Schema$Request {
  return {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: range.startRow,
        endRowIndex: range.endRow + 1,
        startColumnIndex: 0,
        endColumnIndex: range.columnCount,
      },
      cell: { userEnteredFormat: format },
      fields: CELL_FORMAT_FIELDS,
    },
  };
}

/**
 * Builds the visual-formatting requests (fills, bold, borders, frozen
 * header/label, column widths) for a generated game sheet: bold bordered
 * headers throughout, a grey fill on the infield fielding-position rows
 * (1st/2nd/3rd/Float) and bench rows, white on the rest of the fielding
 * grid, and a grey fill on female batting-order rows (white for male).
 */
export function buildFormatRequests(
  sheetId: number,
  sections: GameSheetSections,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];

  const headerFormat: sheets_v4.Schema$CellFormat = {
    textFormat: { bold: true },
    borders: allSidesThin,
  };
  const fieldingFormat: sheets_v4.Schema$CellFormat = {
    backgroundColor: WHITE_FILL,
    textFormat: { bold: true },
    borders: allSidesThin,
  };
  const rosterFormat: sheets_v4.Schema$CellFormat = {
    backgroundColor: GREY_FILL,
    textFormat: { bold: true },
    borders: allSidesThin,
  };
  const borderOnlyFormat: sheets_v4.Schema$CellFormat = {
    borders: allSidesThin,
  };

  // Fielding grid.
  requests.push(
    repeatCellRequest(
      sheetId,
      { startRow: sections.fieldingHeaderRow, endRow: sections.fieldingHeaderRow, columnCount: sections.fieldingColumnCount },
      headerFormat,
    ),
  );
  const fieldingPositionRuns = greyRuns(
    Object.entries(sections.fieldingPositionRowByName).map(([name, rowIndex]) => ({
      rowIndex,
      grey: GREY_FIELDING_POSITIONS.has(name),
    })),
  );
  for (const run of fieldingPositionRuns) {
    requests.push(
      repeatCellRequest(
        sheetId,
        { startRow: run.start, endRow: run.end, columnCount: sections.fieldingColumnCount },
        run.grey ? rosterFormat : fieldingFormat,
      ),
    );
  }
  if (sections.benchRows) {
    requests.push(
      repeatCellRequest(
        sheetId,
        { startRow: sections.benchRows[0], endRow: sections.benchRows[1], columnCount: sections.fieldingColumnCount },
        rosterFormat,
      ),
    );
  }

  // Batting order.
  requests.push(
    repeatCellRequest(
      sheetId,
      { startRow: sections.battingHeaderRow, endRow: sections.battingHeaderRow, columnCount: sections.battingColumnCount },
      headerFormat,
    ),
  );
  const battingRowRuns = greyRuns(
    Object.entries(sections.battingRowGenders).map(([rowIndex, gender]) => ({
      rowIndex: Number(rowIndex),
      grey: gender === GREY_BATTING_GENDER,
    })),
  );
  for (const run of battingRowRuns) {
    requests.push(
      repeatCellRequest(
        sheetId,
        { startRow: run.start, endRow: run.end, columnCount: sections.battingColumnCount },
        run.grey ? rosterFormat : headerFormat,
      ),
    );
  }

  // Scoring section.
  requests.push(
    repeatCellRequest(
      sheetId,
      { startRow: sections.scoringHeaderRow, endRow: sections.scoringHeaderRow, columnCount: sections.scoringColumnCount },
      headerFormat,
    ),
    repeatCellRequest(
      sheetId,
      { startRow: sections.scoringDataRows[0], endRow: sections.scoringDataRows[1], columnCount: sections.scoringColumnCount },
      borderOnlyFormat,
    ),
  );

  // Freeze the fielding header row and the label column so they stay
  // visible when scrolling through many innings/bench rows.
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: {
          frozenRowCount: sections.fieldingHeaderRow + 1,
          frozenColumnCount: 1,
        },
      },
      fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
    },
  });

  // Label column wider than the per-inning data columns.
  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 140 },
      fields: "pixelSize",
    },
  });

  return requests;
}
