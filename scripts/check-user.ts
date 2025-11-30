import { db } from "../src/app/lib/db";

async function main() {
  const email = "admin@example.com"; // Tente o email que você está usando
  const user = await db.user.findUnique({
    where: { email },
    include: {
      WorkspaceMember: {
        include: {
          Workspace: true,
        },
      },
    },
  });

  console.log("User:", user);
  if (user) {
    console.log("Members:", user.WorkspaceMember);
  }
}

main();
