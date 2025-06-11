import puppeteer from "puppeteer";

// Function to convert HTML content to Quill's Delta format
export async function convertHtmlToDelta(htmlContent: string): Promise<string> {
    // Launch Puppeteer browser instance and awaiting page
    const browser = await puppeteer.launch({
        headless: true, // Run in headless mode
        args: ["--no-sandbox", "--disable-gpu"],
    });
    const page = await browser.newPage();

    function processHtml(html: string): string {
        // Step 1: Remove spaces between tags, <div> opening and closing tags, line breaks, and empty font tags
        html = html
            .replace(/\n+/g, "")
            .replace(/>\s+</g, "><")
            .replace(/<div\s+align\s*=\s*["']?center["']?\s*>/g, "<div>")
            .replace(/<div>/g, "<p>")
            .replace(/<\/div>/g, "</p>")
            .replace(/&nbsp;/g, "")
            .replace(/<font[^>]*color=['"]?black['"]?[^>]*>/gi, "")
            .replace(/<font[^>]*face=['"]?TimesNewRomanPSMT['"]?[^>]*>/gi, "")
            .replace(/<font[^>]*>\s*<\/font>/g, " ")
            .replace(/<blockquote>/g, "")
            .replace(/<\/blockquote>/g, "");

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

        // Step 2: Handle nested <ol><li> elements
        html = html.replace(
            /<\/li>\s*<ul>\s*(<li>[\s\S]*?<\/li>)\s*<\/ul>\s*<li>/g,
            (match, nestedList) => {
                // Extract the nested list and update <li> tags with the ql-indent-1 class
                let updatedList = nestedList.replace(
                    /<li>/g,
                    '<li class="ql-indent-1">'
                );
                // Reinsert the modified list and update the surrounding tags
                return `</li>${updatedList}</ul><li>`;
            }
        );

        // Step 3: Handle duplicate <ul> and <ol> tags
        html = html.replace(/<\/li>\s*<\/ol>\s*<li>/g, "</li><li>");
        html = html.replace(/<ul>(\s*<ul>)+/g, "<ul>");
        html = html.replace(/<\/ul>(\s*<\/ul>)+/g, "</ul>");
        html = html.replace(/<ol>(\s*<ol>)+/g, "<ol>");
        html = html.replace(/<\/ol>(\s*<\/ol>)+/g, "</ol>");

        // Step 4: Remove font face, convert font color and background to span and convert closing tags
        html = html
            .replace(/<font[^>]*face="[^"]*"[^>]*>/g, "<span>")
            .replace(/<font color="#/g, '<span style="color: #')
            .replace(
                /<font[^>]*style=["']?BACKGROUND-COLOR:([^;"']+)["']?[^>]*>/gi,
                '<span style="background-color: $1">'
            )
            .replace(/<\/font>/g, "</span>");

        return html;
    }

    htmlContent = htmlContent.replace("_x000D_", ""); // Remove `_x000D_` artifacts

    const processedHtml = processHtml(htmlContent);

    // Set the content of the page to the Quill editor with the processed HTML
    await page.setContent(
        '<html><body><div id="editor"></div><script src="https://cdn.quilljs.com/1.3.7/quill.min.js"></script></body></html>'
    );

    // Wait for the page to load and Quill to initialize
    await page.waitForSelector("#editor");

    // Inject the processed HTML content into the Quill editor
    await page.evaluate((html: string) => {
        const quill = new (window as any).Quill("#editor", { theme: "snow" });
        quill.root.innerHTML = html;
    }, processedHtml);

    // Retrieve the Delta format from Quill
    const delta: any = await page.evaluate(() => {
        // Quill is available inside the page context
        const quill = new (window as any).Quill("#editor", { theme: "snow" });
        return quill.getContents();
    });

    // Add safety checks for delta and its properties
    if (delta && delta.ops && delta.ops.length > 0) {
        // Remove leading \n from the first insert
        if (
            typeof delta.ops[0].insert === "string" &&
            delta.ops[0].insert.startsWith("\n")
        ) {
            delta.ops[0].insert = delta.ops[0].insert.substring(1);
        }

        // Check if the last operation is just a newline and remove it completely
        const lastOpIndex = delta.ops.length - 1;
        const lastOp = delta.ops[lastOpIndex];

        if (lastOp && typeof lastOp.insert === "string") {
            // If the last operation is just a newline, remove it completely
            if (lastOp.insert === "\n" && !lastOp.attributes) {
                delta.ops.pop();
            }
            // If the last operation ends with multiple newlines, trim them
            else if (lastOp.insert.endsWith("\n\n")) {
                lastOp.insert = lastOp.insert.replace(/\n+$/, "");

                // If after trimming the insert becomes empty, remove the operation
                if (lastOp.insert === "" && !lastOp.attributes) {
                    delta.ops.pop();
                }
            }
            // If the last operation ends with a single newline, remove it
            else if (lastOp.insert.endsWith("\n")) {
                lastOp.insert = lastOp.insert.slice(0, -1);

                // If after trimming the insert becomes empty, remove the operation
                if (lastOp.insert === "" && !lastOp.attributes) {
                    delta.ops.pop();
                }
            }
        }
    } else {
        console.error("Delta format is invalid or empty.");
    }

    // Format the Delta as JSON and replace `True` with `true`
    const formattedDelta = JSON.stringify(delta).replace(/True/g, "true");

    await browser.close();

    return formattedDelta;
}

// Function to format a comma-separated string into an array of strings
export const formatCommaStringToArray = (
    string: string,
    isReferencesData: boolean = false
) => {
    return string
        ? `{${string
              .split(",")
              //   .map((ref) => ref.trim().replace("'", "''"))
              .filter(
                  (ref) => !isReferencesData || !ref.includes("Package Insert")
              )
              .map((ref) => `"${ref}"`)
              .join(",")}}`
        : "{}";
};

// Function to format a string with newlines into an array of strings
export const formatNewLinesToArray = (
    string: string,
    isReferencesData: boolean = false
): string => {
    return string
        ? `{${string
              .split("\n") // Split by newline
              .map((ref) => ref.trim().replace("'", "''")) // Trim whitespace and escape single quotes
              .filter(
                  (ref) => !isReferencesData || !ref.includes("Package Insert") // Optional filtering logic
              )
              .map((ref) => `"${ref}"`) // Wrap each item in double quotes
              .join(",")}}` // Join with commas and wrap in curly braces
        : "{}";
};

// Function to format a string with newlines into a single string with spaces
export const removeNewLinesFromString = (string: string): string => {
    if (!string) return "";

    // Replace all newlines and carriage returns with spaces
    return string
        .replace(/[\r\n]+/g, " ") // Handle both \r and \n in any combination
        .trim()
        .replace(/\s{2,}/g, " ") // Replace multiple spaces with a single space
        .replace("'", "''");
};

// Helper function to safely handle undefined or empty values
export function safeGetValue(value: any): any {
    return value === "N/A" || value === null || value === undefined
        ? null
        : value;
}
