import path from "path";
import { readFile, utils } from "xlsx";
import {
    convertHtmlToDelta,
    formatCommaStringToArray,
    formatNewLinesToArray,
    removeNewLinesFromString,
    safeGetValue,
} from "./convertData";
import {
    Medication,
    Formula,
    StatusTypes,
    MOCK_MED_DATA,
    MOCK_FORM_DATA,
} from "./types";

export function processExcel() {
    const EXCEL_FILE = path.resolve(__dirname, "./import/neonatal-new.xlsx");
    const workbook = readFile(EXCEL_FILE);
    const sheetName = workbook.SheetNames[0];
    const data = utils.sheet_to_json(workbook.Sheets[sheetName], {
        raw: false,
    });
    return data;
}

export const CONSTANTS = {
    medication_name_column: "Product Name",
    dosage_form_column: "Modifier",
    medication_type: "neonatal",
    created_by: -999,
    edited_by: -999,
    pharmacy_id: 55,
    status: "edit" as StatusTypes,
};

export function processMedication(row: any, index: number): Medication {
    const medication: Medication = {
        ...MOCK_MED_DATA,
        ...CONSTANTS,
    };
    medication.name = row["Product Name"];
    medication.hazard_risk = row["Hazardous Risk"];
    medication.references_data = `{"Manufacturer Package Insert"}`;

    const reconstitutionSolution = row["Reconstitution Solution"];
    if (!reconstitutionSolution || reconstitutionSolution === "N/A") {
        medication.vial_compatible_diluent = null;
    } else {
        const diluents = reconstitutionSolution
            .split(",")
            .map((d: string) => `"${d.trim()}"`);
        medication.vial_compatible_diluent = `{${diluents.join(",")}}`;
    }

    return medication;
}

export async function processFormula(
    row: any,
    medicationId: number
): Promise<Formula> {
    const formula: Formula = {
        medicationId: medicationId,
        ...MOCK_FORM_DATA,
        ...CONSTANTS,
    };
    formula.dosage_form = row["Modifier"];
    formula.strength = row["Final Concentration"];
    formula.final_appearance = row["Appearance of Final Product"];

    let procedureHtml = row["Procedure HTML"];
    try {
        formula.compounding_procedure = procedureHtml
            ? await convertHtmlToDelta(procedureHtml)
            : // prettier-ignore
              JSON.stringify({ ops: [{ insert: 'No procedure provided\n' }] });
    } catch (e) {
        console.error(`Error converting procedure HTML: ${e}`);
        // prettier-ignore
        formula.compounding_procedure = JSON.stringify({ ops: [{ insert: 'Error processing procedure\n' }] });
    }

    const ingredients: { name: string; amount: string }[] = [];
    for (let i = 1; i <= 3; i++) {
        const ingredientName = removeNewLinesFromString(
            safeGetValue(row[`Ingredient ${i}`])
        );
        const ingredientAmount = removeNewLinesFromString(
            safeGetValue(row[`Amount ${i}`])
        );

        if (ingredientName && ingredientAmount) {
            ingredients.push({
                name: ingredientName,
                amount: ingredientAmount,
            });
        }
    }
    formula.ingredients = ingredients;

    formula.light_protect =
        row[
            "Light Precautions 2,4:_PFL = protect from ambient/room light_NDS"
        ] === "NP"
            ? "No Protection Required"
            : "Protect From Light";

    formula.final_solution_information = [
        {
            room_temp_BUD: row["Neonatal Room Temp BUD"],
            refrigerated_BUD: row["Neonatal Fridge BUD"],
            product_final_concentration: row["Final Concentration"],
            product_final_diluent:
                row["Dilution Solution"] === "N/A"
                    ? "Undiluted"
                    : safeGetValue(row["Dilution Solution"]),
        },
    ];

    const equipmentExcel = row["Equipment"];
    formula.equipment = formatNewLinesToArray(equipmentExcel);

    const suppliesExcel = row["Disposable Supplies"];
    formula.disposable_supplies = formatNewLinesToArray(suppliesExcel);

    const wasteExcel = row["Waste Management"];
    formula.waste_management = formatNewLinesToArray(wasteExcel);

    const neonatalTextReferences = row["Neonatal Text References"];
    formula.references_data = formatCommaStringToArray(
        neonatalTextReferences,
        true
    );

    return formula;
}
