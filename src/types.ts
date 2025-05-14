export type StatusTypes = "edit" | "review" | "publish";

interface VialInformation {
    vial_BUD: string;
    vial_size: string;
    vial_diluent_amount: string;
    vial_final_concentration: string;
}

interface FinalSolutionInformation {
    room_temp_BUD: string;
    refrigerated_BUD: string;
    product_final_concentration: string;
    product_final_diluent: string;
}

interface Ingredients {
    name: string;
    amount: string;
}

export interface Medication {
    medication_type: string;
    name: string;
    brand_name: string;
    hazard_risk: string;
    notes: string;
    vial_information: VialInformation[];
    vial_compatible_diluent: string | null;
    update_summary: string;
    references_data: string;
    created_by: number;
    edited_by: number;
    pharmacy_id: number;
    status: StatusTypes;
}

export interface Formula {
    dosage_form: string;
    strength: string;
    container_closure_system: string;
    light_protect: string;
    type: string[] | null;
    prime_with_active: boolean;
    special_instructions: string;
    final_solution_information: FinalSolutionInformation[];
    equipment: string;
    disposable_supplies: string;
    waste_management: string;
    ingredients: Ingredients[];
    compounding_procedure: string;
    quality_review: string;
    final_appearance: string;
    references_data: string;
    update_summary: string;
    created_by: number;
    edited_by: number;
    pharmacy_id: number;
    medicationId: number;
    status: StatusTypes;
}
