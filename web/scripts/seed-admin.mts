import { seedAdminUser } from "../src/lib/auth/users";

seedAdminUser()
  .then(() => {
    console.log("Admin user seeded (if not already present)");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
