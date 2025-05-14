import express from "express";
import path, { join } from "path";
import puppeteer from "puppeteer";
import { readFile, utils } from "xlsx";

const app = express();
const PORT = 3000;

// Serve static files for the front-end
app.use(express.static(join(__dirname, "public")));

function getProcedureHtmlFromExcel(): string[] {
    const EXCEL_FILE = path.resolve(__dirname, "./import/adult.xlsx");
    const workbook = readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName], {
        raw: false,
    });

    const procedureHtmls: string[] = [];

    // Loop through each row and extract 'Procedure HTML' column
    for (const row of data as any[]) {
        const procedureHtml = row["Procedure HTML"];
        if (procedureHtml) {
            procedureHtmls.push(procedureHtml);
        }
    }

    return procedureHtmls;
}

// Function to convert HTML to Delta (same as your existing function)
export async function convertHtmlToDelta(htmlContent: string): Promise<string> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();

    function processHtml(html: string): string {
        // Step 1: Remove spaces between tags, <div> opening and closing tags, line breaks, and empty font tags
        html = html
            .replace(/\n+/g, "")
            .replace(/>\s+</g, "><")
            .replace(/<div>/g, "")
            .replace(/<\/div>/g, "")
            .replace(/<font[^>]*>\s*<\/font>/g, " ");

        // Step 2: Handle nested <ol><li> elements
        html = html.replace(
            /<\/li>\s*<ol>\s*(<li>[\s\S]*?<\/li>)\s*<\/ol>\s*<li>/g,
            (match, nestedList) => {
                // Extract the nested list and update <li> tags with the ql-indent-1 class
                let updatedList = nestedList.replace(
                    /<li>/g,
                    '<li class="ql-indent-1">'
                );
                // Reinsert the modified list and update the surrounding tags
                return `</li>${updatedList}</ol><li>`;
            }
        );

        // Step 3: Replace </li></ol><li> with </li><li>
        html = html.replace(/<\/li>\s*<\/ol>\s*<li>/g, "</li><li>");
        html = html.replace(/<ul>\s*<ul>/g, "<ul>");
        html = html.replace(/<\/ul>\s*<\/ul>/g, "</ul>");

        // Step 4: Remove font face, convert font color and background to span and convert closing tags
        html = html
            .replace(/<font[^>]*face="[^"]*"[^>]*>/g, "<span>")
            .replace(/<font color="#/g, '<span style="color: #')
            .replace(
                /<font[^>]*style=["']?BACKGROUND-COLOR:([^;"']+)["']?[^>]*>/gi,
                '<span style="background-color: $1">'
            )
            .replace(/<\/font>/g, "</span>");

        // Step 5: Replace &nbsp; with <br>
        html = html.replace(/(&nbsp;\s*)+/g, "<br>");

        return html;
    }

    htmlContent = htmlContent.replace("_x000D_", "");
    const processedHtml = processHtml(htmlContent);

    await page.setContent(
        '<html><body><div id="editor"></div><script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script></body></html>'
    );
    await page.waitForSelector("#editor");
    await page.evaluate((html) => {
        const quill = new (window as any).Quill("#editor", { theme: "snow" });
        quill.root.innerHTML = html;
    }, processedHtml);

    // Retrieve the Delta format from Quill
    const delta: any = await page.evaluate(() => {
        // Quill is available inside the page context
        const quill = new (window as any).Quill("#editor", { theme: "snow" });
        return quill.getContents();
    });

    if (delta && delta.ops && delta.ops.length > 0) {
        if (
            delta.ops[0].insert &&
            typeof delta.ops[0].insert === "string" &&
            delta.ops[0].insert.startsWith("\n")
        ) {
            delta.ops[0].insert = delta.ops[0].insert.substring(1);
        }
        if (
            delta.ops.length > 0 &&
            /^\n+$/.test(delta.ops[delta.ops.length - 1].insert)
        ) {
            delta.ops.pop();
        }
    } else {
        console.error("Delta format is invalid or empty.");
    }

    // Format the Delta as JSON and replace `True` with `true`
    const formattedDelta = JSON.stringify(delta).replace(/True/g, "true");

    await browser.close();

    return formattedDelta;
}

// Endpoint to get Procedure HTML data
app.get("/get-procedure-html", (req, res) => {
    try {
        const procedureHtmls = getProcedureHtmlFromExcel();
        res.json({ procedureHtmls });
    } catch (error) {
        console.error("Error reading Excel file:", error);
        res.status(500).json({ error: "Error reading Excel file" });
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
});
