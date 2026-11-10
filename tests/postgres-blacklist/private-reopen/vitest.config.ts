import { defineConfig } from "vitest/config";
import base from "../../../vitest.config";

// regressionserver/ foi solicitado explicitamente; não expandir config da aplicação.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      "regressionserver/migrations/blacklistPrivateReopen.test.ts",
      "server/migrations/blacklistRolloutFreeze.test.ts",
      "server/routers/blacklist.private.test.ts",
      "server/blacklistPhotoRoutes.test.ts",
      "server/services/blacklist*.test.ts",
      "server/services/kiwifySubscriptionRuntime.test.ts",
    ],
  },
});
