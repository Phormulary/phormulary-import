import express from "express";
import path, { join } from "path";
import { readFile, utils } from "xlsx";
import { convertHtmlToDelta } from "./convertData";

const app = express();
const PORT = 3000;

// Get command line arguments
const args = process.argv.slice(2);
const excelFileName = args[0];
const columnName = args[1];

// Serve static files for the front-end
app.use(express.static(join(__dirname, "public")));

function getProcedureHtmlFromExcel(): string[] {
    const EXCEL_FILE = path.resolve(__dirname, `./import/${excelFileName}`);
    const workbook = readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName], {
        raw: false,
    });

    const procedureHtmls: string[] = [];

    // Loop through each row and extract the specified column
    for (const row of data as any[]) {
        const procedureHtml = row[columnName];
        if (procedureHtml) {
            procedureHtmls.push(procedureHtml);
        }
    }

    return procedureHtmls;
}

// Endpoint to get Procedure HTML data
app.get("/get-procedure-html", (req, res) => {
    try {
        const procedureHtmls = getProcedureHtmlFromExcel();
        res.json({ procedureHtmls });
    } catch (error: any) {
        console.error(`Error reading Excel file (${excelFileName}):`, error);
        res.status(500).json({
            error: `Error reading Excel file: ${error.message}`,
        });
    }
});

// Endpoint to handle HTML to Delta conversion
app.post("/convert", express.json(), async (req, res): Promise<void> => {
    const { htmlContent } = req.body;
    if (!htmlContent) {
        res.status(400).json({ error: "No HTML content provided." });
        return;
    }

    try {
        const delta = await convertHtmlToDelta(htmlContent);
        res.json({ delta });
    } catch (error) {
        console.error("Error during HTML to Delta conversion:", error);
        res.status(500).json({ error: "Conversion failed." });
    }
});

// Serve front-end interface
app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(
        `Processing Excel file: ${excelFileName}, Column: ${columnName}`
    );
});
