import type { FieldErrors } from "./validation";

/** Result of a registration attempt, held by useActionState on the form. */
export type RegisterState =
  | { status: "idle" }
  | { status: "error"; message: string; errors?: FieldErrors }
  | {
      status: "success";
      /** True when this submission created a new record. */
      created: boolean;
      passId: string;
      name: string;
      phoneMasked: string;
      passUrl: string;
      qrSvg: string;
      totalVisits: number;
      /** Visitor said they had attended before but had no record. */
      mismatch: boolean;
      programDate: string;
    };

export const initialRegisterState: RegisterState = { status: "idle" };
