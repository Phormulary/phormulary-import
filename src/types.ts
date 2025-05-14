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

export const MOCK_MED_DATA = {
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

export const MOCK_FORM_DATA = {
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
