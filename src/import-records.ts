import {
    CONSTANTS,
    processMedication,
    processFormula,
    processExcel,
} from "./ucsdNeonatalConfig";
import {
    getExistingMedicationId,
    getExistingFormulaId,
} from "./getExistingRecords";
import { Formula, Medication } from "./types";
import { dbService } from "./dbService";

async function insertMedicationIfNotExists(
    pharmacyId: number,
    row: any,
    rowIndex: number
): Promise<number | null> {
    const medicationName = row[CONSTANTS.medication_name_column];
    if (!medicationName) {
        console.warn(`Row ${rowIndex + 1} skipped: Missing Product Name.`);
        return null;
    }

    const existingMedicationId = await getExistingMedicationId(
        pharmacyId,
        medicationName,
        CONSTANTS.medication_type
    );

    if (existingMedicationId) {
        console.log(
            `Row ${rowIndex + 1}: Medication '${medicationName}' already exists with ID ${existingMedicationId}.`
        );
        return existingMedicationId;
    } else {
        console.log(`Row ${rowIndex + 1}: Processing '${medicationName}'...`);
    }

    const medicationData: Medication = processMedication(row, rowIndex);
    const insertMedicationQuery = `
    INSERT INTO phormulary_dev.medication
    (
      name, brand_name, notes, hazard_risk, references_data, 
      vial_information, status, pharmacy_id, created_by, 
      edited_by, medication_type,
      vial_compatible_diluent, update_summary
    )
    VALUES
    (
      $1, $2, $3, $4, $5,
      $6::jsonb[], $7, $8, $9,
      $10, $11,
      $12, $13
    ) RETURNING id;
  `;

    const values = [
        medicationData.name,
        medicationData.brand_name,
        medicationData.notes,
        medicationData.hazard_risk,
        medicationData.references_data,
        medicationData.vial_information,
        medicationData.status,
        medicationData.pharmacy_id,
        medicationData.created_by,
        medicationData.edited_by,
        medicationData.medication_type,
        medicationData.vial_compatible_diluent,
        medicationData.update_summary,
    ];

    try {
        const result = await dbService.query(insertMedicationQuery, values);
        const medicationId = result.rows[0]?.id || null;
        console.log(
            `Row ${rowIndex + 1}: Medication '${medicationName}' inserted successfully with ID: ${medicationId}`
        );
        return medicationId;
    } catch (error) {
        console.error(
            `Row ${rowIndex + 1}: Error inserting medication '${medicationName}': ${error}`
        );
        return null;
    }
}

async function insertFormulaIfNotExists(
    pharmacyId: number,
    row: any,
    rowIndex: number,
    medicationId: number
): Promise<void> {
    const medicationName = row[CONSTANTS.medication_name_column];
    const dosageForm = row[CONSTANTS.dosage_form_column];

    if (!dosageForm) {
        console.warn(
            `Row ${rowIndex + 1}: Missing Dosage Form. Skipping formula insertion.`
        );
        return;
    }

    const existingFormulaId = await getExistingFormulaId(
        pharmacyId,
        medicationId,
        dosageForm
    );

    if (existingFormulaId) {
        console.log(
            `Row ${rowIndex + 1}: Formula '${medicationName} ${dosageForm}' already exists.`
        );
        return;
    } else
        console.log(
            `Row ${rowIndex + 1}: Processing '${medicationName} ${dosageForm}'...`
        );

    const formulaData: Formula = await processFormula(row, medicationId);
    const insertFormulaQuery = `
    INSERT INTO phormulary_dev.formulation
    (
      dosage_form, strength, container_closure_system, light_protect, type, prime_with_active,
      special_instructions, final_solution_information, equipment, 
      disposable_supplies, waste_management, ingredients, compounding_procedure, 
      quality_review, final_appearance, references_data, created_by,
      edited_by, pharmacy_id, medication_id, status, update_summary
    )
    VALUES
    (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, 
      $10, $11, $12, $13, 
      $14, $15, $16, $17, 
      $18, $19, $20, $21, $22
    );
  `;

    const values = [
        formulaData.dosage_form,
        formulaData.strength,
        formulaData.container_closure_system,
        formulaData.light_protect,
        formulaData.type,
        formulaData.prime_with_active,
        formulaData.special_instructions,
        formulaData.final_solution_information,
        formulaData.equipment,
        formulaData.disposable_supplies,
        formulaData.waste_management,
        formulaData.ingredients,
        formulaData.compounding_procedure,
        formulaData.quality_review,
        formulaData.final_appearance,
        formulaData.references_data,
        formulaData.created_by,
        formulaData.edited_by,
        formulaData.pharmacy_id,
        formulaData.medicationId,
        formulaData.status,
        formulaData.update_summary,
    ];

    try {
        await dbService.query(insertFormulaQuery, values);
        console.log(
            `Row ${rowIndex + 1}: Formula for '${medicationName} ${dosageForm}' inserted successfully.`
        );
    } catch (error) {
        console.error(
            `Row ${rowIndex + 1}: Error inserting formula for '${medicationName} ${dosageForm}': ${error}`
        );
    }
}

(async () => {
    const data = processExcel();

    try {
        console.log("Starting to process data...");
        for (const [index, row] of data.entries()) {
            const medicationId = await insertMedicationIfNotExists(
                CONSTANTS.pharmacy_id,
                row,
                index
            );

            if (medicationId) {
                await insertFormulaIfNotExists(
                    CONSTANTS.pharmacy_id,
                    row,
                    index,
                    medicationId
                );
            }
        }

        console.log("Data processing complete.");
    } catch (error) {
        console.error(
            `Unexpected error: ${error instanceof Error ? error.message : error}`
        );
    } finally {
        await dbService.disconnect();
    }
})();
