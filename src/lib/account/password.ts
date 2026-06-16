type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: "invalid_current_password" | "user_not_found" };

// STUB (passo vermelho §5.4): retorna um sentinel que NÃO casa com nenhuma asserção,
// p/ os testes de integração falharem na lógica (não no import). Real vem no green.
export async function changePassword(
  _userId: string,
  _input: {
    currentPassword: string;
    newPassword: string;
    keepSessionId: string;
  },
): Promise<ChangePasswordResult> {
  return { ok: false, error: "not_implemented" as never };
}
