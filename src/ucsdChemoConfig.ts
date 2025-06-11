import path from "path";
import { readFile, utils } from "xlsx";
import { convertHtmlToDelta, safeGetValue } from "./convertData";
import {
    Medication,
    Formula,
    StatusTypes,
    MOCK_MED_DATA,
    MOCK_FORM_DATA,
} from "./types";

export function processExcel() {
    const EXCEL_FILE = path.resolve(__dirname, "./import/ChemoQuery.xlsx");
    const workbook = readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName], {
        raw: false,
    });
    return data;
}

export const CONSTANTS = {
    medication_name_column: "GenericName",
    dosage_form_column: "DosageForm",
    medication_type: "chemo,-mab,-misc",
    created_by: -999,
    edited_by: -999,
    pharmacy_id: 55,
    status: "publish" as StatusTypes,
};

// Shared utility functions
function isValidRow(row: any): boolean {
    const pageNumber = row["PageNumber"];
    if (pageNumber === "999") {
        return false;
    }

    const medName = row["GenericName"]?.toLowerCase();
    if (
        medName?.toLowerCase().includes("placeholder") ||
        medName?.toLowerCase().includes("place holder")
    ) {
        return false;
    }

    return true;
}

export function extractBrandName(row: any): string {
    const brand_name = row["BrandName"];
    const brandMatch = brand_name?.match(/\(([^)]+)\)/);
    return brandMatch ? brandMatch[1] : "";
}

// Helper function to determine product_final_diluent based on priority rules
function determineProductFinalDiluent(row: any): string {
    const infusionBag = safeGetValue(row["InfusionBag"])?.trim();
    const qsDiluent = safeGetValue(row["QSDiluent"])?.trim();
    const compatibleDiluent = safeGetValue(row["CompatibleSolutions"])?.trim();

    // Highest priority: InfusionBag mappings
    if (infusionBag) {
        switch (infusionBag) {
            case "0.9% Sodium Chloride Injection":
            case "0.9% Sodium Chloride Injection (non-PVC)":
                return "NS";
            case "Dextrose 5% Water Injection":
                return "D5W";
        }
    }

    // Medium priority: QSDiluent mappings to NS
    if (qsDiluent) {
        const nsQSDiluents = [
            "0.9% Sodium Chloride",
            "0.9% Sodium Chloride (PF)",
            "0.9% Sodium Chloride (PF) Injection",
            "0.9% Sodium Chloride (PF) Injection, USP",
            "0.9% Sodium Chloride for Injection",
            "0.9% Sodium Chloride Injection",
            "0.9% Sodium Chloride Injection (PF)",
        ];

        if (nsQSDiluents.includes(qsDiluent)) {
            return "NS";
        }
    }

    // Lowest priority: Use CompatibleDiluent if present, otherwise PLACEHOLDER
    return compatibleDiluent || "PLACEHOLDER";
}

export function processMedication(row: any, index: number): Medication | null {
    if (!isValidRow(row)) {
        return null;
    }

    const medication: Medication = {
        ...MOCK_MED_DATA,
        ...CONSTANTS,
    };

    // Set medication name
    medication.name = row["GenericName"];

    // Set brand name
    medication.brand_name = extractBrandName(row);

    // Set hazardous risk
    const hazardousRisk = row["HazardousCategory"];
    if (hazardousRisk === "Hazardous - Antineoplastic") {
        medication.hazard_risk = "Antineoplastic";
    } else if (hazardousRisk === "Hazardous - NonAntineoplastic") {
        medication.hazard_risk = "Non-Antineoplastic";
    } else if (hazardousRisk === "Hazardous - Reproductive toxin") {
        medication.hazard_risk = "Reproductive Toxin";
    } else {
        medication.hazard_risk = "Not Hazardous";
    }

    // Set vial information
    medication.vial_information = {};

    const rawReferences = row["References"];

    // Split and clean all references
    let referenceList =
        rawReferences
            ?.split(/\r?\n/)
            .map((ref: string) => ref.replace(/^\d+\.\s*/, "").trim())
            .filter((ref: string) => ref.length > 0) || [];

    // Identify "prescribing information" references (case-insensitive)
    const prescribingInfoRefs = referenceList.filter(
        (ref: string) =>
            ref.toLowerCase().includes("prescribing information]") ||
            ref.toLowerCase().includes("product information") ||
            ref.toLowerCase().includes("product monograph")
    );

    // Medication references:
    // Take first reference + all "prescribing information" references
    const firstReference = referenceList[0];
    const medicationRefsSet = new Set([
        ...(firstReference ? [firstReference] : []),
        ...prescribingInfoRefs,
    ]);
    medication.references_data = `{${[...medicationRefsSet].map((r) => `"${r}"`).join(", ")}}`;

    return medication;
}

export async function processFormula(
    row: any,
    medicationId: number
): Promise<Formula | null> {
    if (!isValidRow(row)) {
        return null;
    }

    const formula: Formula = {
        medicationId: medicationId,
        ...MOCK_FORM_DATA,
        ...CONSTANTS,
    };

    // Set dosage form
    const brandName = row["BrandName"]?.trim();
    const dispenseType = row["DispenseType"];

    let backupDosageForm = "Infusion";
    if (
        dispenseType === "Syringe - SQ" ||
        dispenseType === "Chemo Syringe - SQ"
    ) {
        backupDosageForm = "Subcutaneous Injection";
    } else if (
        dispenseType === "Syringe - IV" ||
        dispenseType === "Chemo Syringe - IV"
    ) {
        backupDosageForm = "Intravenous Injection";
    } else if (dispenseType === "Chemo Syringe - intraARTERIAL") {
        backupDosageForm = "Intra-ARTERIAL";
    }

    if (brandName) {
        const closingParenIndex = brandName.indexOf(")");
        if (closingParenIndex !== -1) {
            const afterParen = brandName
                .substring(closingParenIndex + 1)
                .trim();
            formula.dosage_form = afterParen || backupDosageForm;
        } else {
            formula.dosage_form = brandName;
        }
    } else {
        formula.dosage_form = backupDosageForm;
    }

    formula.container_closure_system = row["DispenseType"];

    // Set light protection
    formula.light_protect = (() => {
        const protectValue = row["ProtectFromLight"]?.trim();

        if (!protectValue) {
            return "No Protection Required";
        }

        // Translate the value based on the rules
        if (protectValue.includes("Yes")) {
            if (protectValue.includes("refrigerated")) {
                if (protectValue.includes("Riabni")) {
                    return "Protect From Light If Riabni Refrigerated";
                }
                return "Protect From Light If Refrigerated";
            }
            if (protectValue.includes("storage")) {
                return "Protect From Light During Storage";
            }
            return "Protect From Light";
        }

        return "No Protection Required";
    })();

    // Set final solution information
    formula.final_solution_information = [
        {
            room_temp_BUD: row["BUDRoom"],
            refrigerated_BUD: row["BUDFridge"],
            product_final_concentration: row["FinalConcentration"] || "Varies",
            product_final_diluent: determineProductFinalDiluent(row),
        },
    ];

    const ingredients: { name: string; amount: string }[] = [];

    // Ordered list of ingredient keys
    const ingredientOrder = [
        "Ing1",
        "Ing5",
        "Ing2",
        "Ing6",
        "Ing3",
        "Ing7",
        "Ing4",
        "Ing8",
        "Ing9",
        "Ing10",
        "Ing11",
        "Ing12",
        "Ing13",
        "Ing14",
        "Ing15",
    ];

    // Group A: standard ingredients
    const groupA = new Set([
        "Ing2",
        "Ing3",
        "Ing4",
        "Ing9",
        "Ing11",
        "Ing13",
        "Ing14",
        "Ing15",
    ]);

    // Group B: vial diluents
    const groupB = new Set(["Ing5", "Ing6", "Ing7", "Ing8", "Ing10", "Ing12"]);

    let lastNonBlankNameA = "";
    let lastNonBlankNameB = "";

    // Add Ing# ingredients
    for (const key of ingredientOrder) {
        const amountKey = `${key}supply`;
        const amount = safeGetValue(row[amountKey]) || "";
        let name = safeGetValue(row[key]);

        if (!name && amount) {
            if (groupA.has(key)) {
                name = lastNonBlankNameA;
            } else if (groupB.has(key)) {
                name = lastNonBlankNameB;
            }
        }

        if (name) {
            if (groupB.has(key)) {
                name = `Vial Diluent: ${name}`;
                lastNonBlankNameB = name;
            } else if (groupA.has(key) || key === "Ing1") {
                lastNonBlankNameA = name;
            }
            ingredients.push({ name, amount });
        }
    }

    // Add alternative diluents if present
    const altDiluentFields = [
        { nameKey: "AltDiluent", volumeKey: "AltDiluentVolume" },
        { nameKey: "AltDiluent1", volumeKey: "AltDilutentVolume1" }, // note the typo
    ];

    for (const { nameKey, volumeKey } of altDiluentFields) {
        const name = safeGetValue(row[nameKey]);
        if (name) {
            const amount = safeGetValue(row[volumeKey]) || "";
            ingredients.push({ name: `Alternative Diluent: ${name}`, amount });
        }
    }

    // Add QS Diluent if present
    const qsDiluent = safeGetValue(row["QSDiluent"]);
    if (qsDiluent) {
        const amount = safeGetValue(row["QSDiluentVolume"]) || "";
        ingredients.push({ name: `QS Diluent: ${qsDiluent}`, amount });
    }

    // Add Infusion Bag if present
    const infusionBag = safeGetValue(row["InfusionBag"]);
    if (infusionBag) {
        const amount = safeGetValue(row["InfusionBagVolume"]) || "";
        ingredients.push({ name: `Infusion Bag: ${infusionBag}`, amount });
    }

    // Assign to formula
    formula.ingredients = ingredients;

    // Set equipment
    const equipmentArray: string[] = [];
    const equipmentColumns = ["Equipment", "Equip1", "Equp2", "Equip3"];

    equipmentColumns.forEach((column) => {
        const rawValue = row[column];

        // Trim and skip empty or whitespace-only values
        const equipment = rawValue?.trim();
        if (equipment) {
            // Escape single quotes for SQL safety
            equipmentArray.push(equipment.replace(/'/g, "''"));
        }
    });

    formula.equipment = `{${equipmentArray.map((e) => `"${e}"`).join(",")}}`;

    // Set waste management
    const wasteArray: string[] = [];
    const wasteColumns = [
        "WasteManagement",
        "WasteManagement1",
        "WasteManagement2",
        "WasteManagement3",
    ];

    wasteColumns.forEach((column) => {
        const rawValue = row[column];

        // Trim and skip empty or whitespace-only values
        const waste = rawValue?.trim();
        if (waste) {
            // Escape single quotes for SQL safety
            wasteArray.push(waste.replace(/'/g, "''"));
        }
    });

    formula.waste_management = `{${wasteArray.map((w) => `"${w}"`).join(",")}}`;

    // Set disposable supplies
    const suppplyArray: string[] = [];

    for (let i = 1; i <= 13; i++) {
        const rawValue = row[`DispSupply${i}`];

        // Trim and skip empty or whitespace-only values
        const supply = rawValue?.trim();
        if (supply) {
            // Escape single quotes for SQL safety
            suppplyArray.push(supply.replace(/'/g, "''"));
        }
    }

    formula.disposable_supplies = `{${suppplyArray.map((s) => `"${s}"`).join(",")}}`;

    // Set compounding procedure
    let procedureHtml = row["Procedures"];
    try {
        if (procedureHtml) {
            const regex =
                /<div[^>]*>.*?FINAL APPEARANCE.*?<\/div>[\s\S]*?<([a-z]+)[^>]*>.*?<\/\1>/i;
            let cleanedHtml = procedureHtml.replace(regex, "");

            // Convert the cleaned HTML to Delta format
            const baseDeltaJson = await convertHtmlToDelta(cleanedHtml);
            const baseDelta = JSON.parse(baseDeltaJson);

            // Define file path to hash mappings
            const imageMappings = {
                "N:\\INFPH\\MOORESRX\\MF Pictures\\_final-non-haz-Cleaning.jpg":
                    "9089504298f77ee549a5208b987def0cd0ea46d5afcc90d34e485506bd77756a",
                "C:\\Users\\vanle\\Documents\\Master Formula\\2024\\Cleaning\\_final-non-haz-Cleaning.jpg":
                    "9089504298f77ee549a5208b987def0cd0ea46d5afcc90d34e485506bd77756a",
                "N:\\INFPH\\MOORESRX\\MF Pictures\\_final-30-seconds-haz-Cleaning.jpg":
                    "f04db7802986c6642b67bd6ea40dcdf9315d1b39c6a06fba283edc754f261d7d",
                "C:\\Users\\vanle\\Documents\\Master Formula\\2024\\Cleaning\\_final-30-seconds-haz-Cleaning.jpg":
                    "f04db7802986c6642b67bd6ea40dcdf9315d1b39c6a06fba283edc754f261d7d",
                "N:\\INFPH\\MOORESRX\\MF Pictures\\_final-5-minutes-haz-Cleaning.jpg":
                    "0ceaaa4e437dab367cdf71a4e3858fdf47a9e30538e3a8cb20821a750f6d13f7",
            };

            const pic = row["Pic"]?.trim();
            const hash =
                pic && pic in imageMappings
                    ? imageMappings[pic as keyof typeof imageMappings]
                    : undefined;

            if (hash) {
                const qcOps = [
                    {
                        insert: "QUALITY CONTROL PROCEDURES",
                        attributes: { color: "#c0504d" },
                    },
                    { insert: "\n" },
                    {
                        insert: {
                            image: {
                                hash,
                                src: "",
                                width: "750",
                                height: "auto",
                                style: "margin: 5px;",
                            },
                        },
                    },
                ];

                baseDelta.ops = baseDelta.ops.concat(qcOps);
            }

            formula.compounding_procedure = JSON.stringify(baseDelta);
        } else {
            formula.compounding_procedure = JSON.stringify({
                ops: [{ insert: "No procedure provided\n" }],
            });
        }
    } catch (e) {
        console.error(`Error converting procedure HTML: ${e}`);
        formula.compounding_procedure = JSON.stringify({
            ops: [{ insert: "Error processing procedure\n" }],
        });
    }

    // Set special instructions
    let specialInstructionsHtml =
        (row["SpecialInstructions"] || "") +
        (row["StorageHandling"] || "") +
        (row["RecommendedContainer"] || "") +
        (row["InfusionBagNote"] || "");
    try {
        formula.special_instructions = specialInstructionsHtml
            ? await convertHtmlToDelta(specialInstructionsHtml)
            : // prettier-ignore
              JSON.stringify({ ops: [{ insert: 'No special instructions provided\n' }] });
    } catch (e) {
        console.error(`Error converting special instructions HTML: ${e}`);
        // prettier-ignore
        formula.special_instructions = JSON.stringify({ ops: [{ insert: 'Error processing special instructions\n' }] });
    }

    // Set quality review
    let qualityReviewHtml = row["QRInitial"] + row["QualityControlReview"];
    try {
        formula.quality_review = qualityReviewHtml
            ? await convertHtmlToDelta(qualityReviewHtml)
            : // prettier-ignore
              JSON.stringify({ ops: [{ insert: 'No quality review provided\n' }] });
    } catch (e) {
        console.error(`Error converting quality review HTML: ${e}`);
        // prettier-ignore
        formula.quality_review = JSON.stringify({ ops: [{ insert: 'Error processing quality review\n' }] });
    }

    function extractFinalAppearance(procedureHtml: string): string | null {
        if (!procedureHtml) return null;

        // Step 1: Strip HTML tags
        const text = procedureHtml
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();

        // Step 2: Find "FINAL APPEARANCE"
        const finalAppearanceIndex = text
            .toUpperCase()
            .indexOf("FINAL APPEARANCE");
        if (finalAppearanceIndex === -1) return null;

        const remainingText = text.slice(
            finalAppearanceIndex + "FINAL APPEARANCE".length
        );

        // Step 3: Find the next ALL CAPS section header (2+ words in ALL CAPS)
        const sectionEndMatch = remainingText.match(/\b([A-Z\s]{4,})\b/);
        const endIndex = sectionEndMatch
            ? sectionEndMatch.index!
            : remainingText.length;

        // Step 4: Extract the text in between
        let appearanceText = remainingText.slice(0, endIndex).trim();

        // Step 5: Remove leading numbers like "1." or "1)"
        appearanceText = appearanceText.replace(/^\d+[\.\)]\s*/, "");

        return appearanceText || null;
    }

    formula.final_appearance =
        extractFinalAppearance(procedureHtml) || "PLACEHOLDER";

    // Formulation references:
    const rawReferences = row["References"];

    // Split and clean all references
    let referenceList =
        rawReferences
            ?.split(/\r?\n/)
            .map((ref: string) => ref.replace(/^\d+\.\s*/, "").trim())
            .filter((ref: string) => ref.length > 0) || [];

    // Identify "prescribing information" references (case-insensitive)
    const prescribingInfoRefs = referenceList.filter(
        (ref: string) =>
            ref.toLowerCase().includes("prescribing information]") ||
            ref.toLowerCase().includes("product information") ||
            ref.toLowerCase().includes("product monograph")
    );
    const firstReference = referenceList[0];
    const medicationRefsSet = new Set([
        ...(firstReference ? [firstReference] : []),
        ...prescribingInfoRefs,
    ]);
    // Remove medication references from the full list
    let formulationRefs = referenceList.filter(
        (ref: string) => !medicationRefsSet.has(ref)
    );

    // Use "USP 797" if no formulation references remain
    if (formulationRefs.length === 0) {
        formulationRefs = ["USP 797"];
    }

    formula.references_data = `{${formulationRefs.map((r: string) => `"${r}"`).join(", ")}}`;

    return formula;
}
