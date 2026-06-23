import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests live in each package's test/ dir, kept out of src/ so tsc never
    // compiles them into dist.
    include: ["packages/**/test/**/*.test.ts"],
    environment: "node",
  },
});
