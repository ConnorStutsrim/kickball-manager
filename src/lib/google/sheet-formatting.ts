import type { sheets_v4 } from "googleapis";
import type { GameSheetSections } from "./sheet-layout";

// Palette extracted from the team's real spreadsheet (Kickball 2026 Fall.xlsx):
// theme accent1 (#156082) tinted 60% lighter for the fielding grid, and the
// explicit pink (#FFCCFF) used throughout for "this cell names a player"
// (bench rows and the batting order table).
const TEAL_FILL: sheets_v4.Schema$Color = { red: 0.631, green: 0.749, blue: 0.804 };
const PINK_FILL: sheets_v4.Schema$Color = { red: 1, green: 0.8, blue: 1 };
const THIN_BORDER_STYLE = "SOLID";

const thinBorder: sheets_v4.Schema$Border = { style: THIN_BORDER_STYLE };
const allSidesThin: sheets_v4.Schema$Borders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

const CELL_FORMAT_FIELDS = "userEnteredFormat(backgroundColor,textFormat.bold,borders)";

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
 * header/label, column widths) for a generated game sheet, matching the
 * team's real spreadsheet's palette: bold bordered headers, a light teal
 * fill for fielding-grid assignments, and a light pink fill for any cell
 * naming a player (bench rows, batting order rows).
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
  const tealFormat: sheets_v4.Schema$CellFormat = {
    backgroundColor: TEAL_FILL,
    textFormat: { bold: true },
    borders: allSidesThin,
  };
  const pinkFormat: sheets_v4.Schema$CellFormat = {
    backgroundColor: PINK_FILL,
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
    repeatCellRequest(
      sheetId,
      { startRow: sections.fieldingPositionRows[0], endRow: sections.fieldingPositionRows[1], columnCount: sections.fieldingColumnCount },
      tealFormat,
    ),
  );
  if (sections.benchRows) {
    requests.push(
      repeatCellRequest(
        sheetId,
        { startRow: sections.benchRows[0], endRow: sections.benchRows[1], columnCount: sections.fieldingColumnCount },
        pinkFormat,
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
  if (sections.battingDataRows[1] >= sections.battingDataRows[0]) {
    requests.push(
      repeatCellRequest(
        sheetId,
        { startRow: sections.battingDataRows[0], endRow: sections.battingDataRows[1], columnCount: sections.battingColumnCount },
        pinkFormat,
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
