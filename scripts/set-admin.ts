import { db } from "../src/app/lib/db";

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Por favor, forneça o email do usuário.");
    console.log("Uso: npx tsx scripts/set-admin.ts <email>");
    process.exit(1);
  }

  try {
    const user = await db.user.update({
      where: { email },
      data: { role: "admin" },
    });
    console.log(`Usuário ${email} atualizado para admin com sucesso!`);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
  }
}

main();
