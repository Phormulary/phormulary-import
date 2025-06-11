import { dbService } from "./dbService";

const schemaName = process.env.DB_SCHEMA;

export async function getExistingMedicationId(
    pharmacyId: number,
    name: string,
    brandName: string,
    medicationType: string
): Promise<number | null> {
    const query = `
    SELECT id, live_id 
    FROM ${schemaName}.medication
    WHERE pharmacy_id = $1 AND name = $2 AND brand_name = $3 AND medication_type = $4
    ORDER BY id ASC; -- Ensure the lowest id is selected first
    `;
    const result = await dbService.query(query, [
        pharmacyId,
        name,
        brandName,
        medicationType,
    ]);

    if (result.rows.length > 0) {
        const { id, live_id } = result.rows[0];
        return live_id !== null ? live_id : id;
    }

    return null;
}

export async function getExistingFormulaId(
    pharmacyId: number,
    medicationId: number,
    dosageForm: string
): Promise<number | null> {
    const query = `
    SELECT id, live_id
    FROM ${schemaName}.formulation
    WHERE pharmacy_id = $1 AND medication_id = $2 AND dosage_form = $3
    ORDER BY id ASC;
    `;

    const result = await dbService.query(query, [
        pharmacyId,
        medicationId,
        dosageForm,
    ]);

    if (result.rows.length > 0) {
        const { id, live_id } = result.rows[0];
        return live_id !== null ? live_id : id;
    }

    return null;
}
