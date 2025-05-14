import path from "path";
import { readFile, utils } from "xlsx";
import {
    convertHtmlToDelta,
    formatCommaStringToArray,
    formatNewLinesToArray,
    safeGetValue,
} from "./convertData";
import { Medication, Formula, StatusTypes } from "./types";

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

const MOCK_MED_DATA = {
    name: "",
    brand_name: "",
    hazard_risk: "Not Hazardous",
    notes: "",
    vial_information: [
        {
            vial_BUD: "PLACEHOLDER",
            vial_size: "PLACEHOLDER",
            vial_diluent_amount: "PLACEHOLDER",
            vial_final_concentration: "PLACEHOLDER",
        },
    ],
    vial_compatible_diluent: "{}",
    update_summary: JSON.stringify({ ops: [{ insert: "New medication\n" }] }),
    references_data: `{"Manufacturer Package Insert"}`,
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

const MOCK_FORM_DATA = {
    dosage_form: "PLACEHOLDER",
    strength: "Variable",
    container_closure_system: "PLACEHOLDER",
    light_protect: "No Protection Required",
    type: null,
    prime_with_active: false,
    // prettier-ignore
    special_instructions: JSON.stringify({"ops":[{"insert":"\n"}]}),
    final_solution_information: [
        {
            room_temp_BUD: "PLACEHOLDER",
            refrigerated_BUD: "PLACEHOLDER",
            product_final_concentration: "PLACEHOLDER",
            product_final_diluent: "PLACEHOLDER",
        },
    ],
    equipment: "PLACEHOLDER",
    disposable_supplies: "PLACEHOLDER",
    waste_management: "PLACEHOLDER",
    ingredients: [{ name: "PLACEHOLDER", amount: "PLACEHOLDER" }],
    // prettier-ignore
    compounding_procedure: JSON.stringify({"ops":[{insert: "Procedure goes here\n"}]}),
    // prettier-ignore
    quality_review: JSON.stringify({"ops":[{"attributes":{"bold":true},"insert":"Point of Pull"},{"insert":"\nCorrect ingredients are pulled"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Ingredients not expired or damaged"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Ingredients secured and stored appropriately until preparation"},{"attributes":{"list":"bullet"},"insert":"\n"},{"attributes":{"bold":true},"insert":"Dilution Preparation (if needed):"},{"insert":"\nProper ingredients and amounts used"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Product is appropriately transferred for dilution"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Proper labeling applied to dilution"},{"attributes":{"list":"bullet"},"insert":"\n"},{"attributes":{"bold":true},"insert":"Pharmacist Dilution Verification (if needed):"},{"insert":"\nCorrect ingredients and amounts used"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Product is appropriately transferred for dilution"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Proper labeling affixed to dilution"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Beyond use date is validated"},{"attributes":{"list":"bullet"},"insert":"\n"},{"attributes":{"bold":true},"insert":"Product Preparation"},{"insert":"\nProper ingredients and amounts used"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Product is appropriately transferred to final container"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Proper labeling applied to final container"},{"attributes":{"list":"bullet"},"insert":"\n"},{"attributes":{"bold":true},"insert":"Pharmacist Verification:"},{"insert":"\nCorrect ingredients and amounts used"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Product is appropriately transferred to final container"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Proper labeling affixed to the final container"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Beyond use date is validated"},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":"Product is secured and stored appropriately"},{"attributes":{"list":"bullet"},"insert":"\n"}]}),
    final_appearance: "PLACEHOLDER",
    references_data: `{"PLACEHOLDER"}`,
    // prettier-ignore
    update_summary: JSON.stringify({ ops: [{ insert: "New formulation\n" }] }),
};

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
