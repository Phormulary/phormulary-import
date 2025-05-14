import path from "path";
import { readFile, utils } from "xlsx";
import {
    convertHtmlToDelta,
    formatCommaStringToArray,
    formatNewLinesToArray,
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
    const EXCEL_FILE = path.resolve(__dirname, "./import/adult.xlsx");
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
    medication_type: "adult",
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
    medication.hazard_risk = row["USP 800 Hazardous"];
    medication.references_data = `{"Manufacturer Package Insert"}`;
    medication.vial_information = [
        {
            vial_BUD: row["Vial BUD_*based on USP 797_"],
            vial_size:
                row["Vial Size_(M) = multiple dose vial; (S) = single dose"],
            vial_diluent_amount: row["Diluent Volume"],
            vial_final_concentration:
                row[
                    "Standard Vial Conc#*_* std Mfr conc or once reconstituted if app"
                ],
        },
    ];

    // Sets table to ophthalmic for row 251 and above
    if (index >= 250) {
        medication.medication_type = "ophthalmic";
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
        const ingredientName = safeGetValue(row[`Ingredient ${i}`]);
        const ingredientAmount = safeGetValue(row[`Amount ${i}`]);

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
            room_temp_BUD:
                row["USP BUD_Room Temp_(max 48hr w/o sterility testing)"],
            refrigerated_BUD:
                row["USP BUD_Fridge_(max 14 days w/o sterility testing)"],
            product_final_concentration:
                row[
                    "Std Conc Range (final product) 5,8 unless otherwise noted"
                ],
            product_final_diluent:
                row[
                    "Compatibility (NS/D5W) - For compatibility in other solns refer"
                ] === "N/A"
                    ? "Undiluted"
                    : safeGetValue(
                          row[
                              "Compatibility (NS/D5W) - For compatibility in other solns refer"
                          ]
                      ),
        },
    ];

    const equipmentExcel = row["Equipment"];
    formula.equipment = formatNewLinesToArray(equipmentExcel);

    const suppliesExcel = row["Disposable Supplies"];
    formula.disposable_supplies = formatNewLinesToArray(suppliesExcel);

    const wasteExcel = row["Waste Management"];
    formula.waste_management = formatNewLinesToArray(wasteExcel);

    const textReferences = row["Text References"];
    formula.references_data = formatCommaStringToArray(textReferences, true);

    return formula;
}
