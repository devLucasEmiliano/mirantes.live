type UpdateProfileResult =
  | {
      ok: true;
      user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        createdAt: Date;
      };
    }
  | { ok: false; error: "email_taken" };

// STUB (passo vermelho §5.4). Real vem no green.
export async function updateProfile(
  _userId: string,
  _input: { name: string; email: string },
): Promise<UpdateProfileResult> {
  return { ok: false, error: "not_implemented" as never };
}
