import {
  createMockSettingDefinition,
  createMockSettings,
} from "metabase-types/api/mocks";
import { screen } from "__support__/ui";

import {
  setup,
  type SetupOpts,
  FULL_APP_EMBEDDING_URL,
  EMAIL_URL,
} from "./setup";

const setupEnterprise = async (opts?: SetupOpts) => {
  await setup({ ...opts, hasEnterprisePlugins: true });
};

describe("SettingsEditor", () => {
  describe("full-app embedding", () => {
    it("should show info about full app embedding", async () => {
      await setupEnterprise({
        settings: [
          createMockSettingDefinition({ key: "enable-embedding" }),
          createMockSettingDefinition({ key: "embedding-app-origin" }),
        ],
        settingValues: createMockSettings({ "enable-embedding": true }),
        initialRoute: FULL_APP_EMBEDDING_URL,
      });

      expect(screen.getByText("Full-app embedding")).toBeInTheDocument();
      expect(screen.getByText(/some of our paid plans/)).toBeInTheDocument();
      expect(screen.queryByText("Authorized origins")).not.toBeInTheDocument();
    });
  });

  describe("subscription allowed domains", () => {
    it("should not be visible", async () => {
      await setupEnterprise({
        settings: [
          createMockSettingDefinition({ key: "subscription-allowed-domains" }),
        ],
        settingValues: createMockSettings({
          "subscription-allowed-domains": "somedomain.com",
        }),
        initialRoute: EMAIL_URL,
      });

      expect(
        screen.queryByText(/approved domains for notifications/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("subscription user visibility", () => {
    it("should not be visible", async () => {
      await setupEnterprise({
        settings: [createMockSettingDefinition({ key: "user-visibility" })],
        settingValues: createMockSettings({ "user-visibility": "all" }),
        initialRoute: EMAIL_URL,
      });

      expect(
        screen.queryByText(
          /suggest recipients on dashboard subscriptions and alerts/i,
        ),
      ).not.toBeInTheDocument();
    });
  });
});
