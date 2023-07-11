import {
  createMockSettingDefinition,
  createMockSettings,
  createMockTokenFeatures,
} from "metabase-types/api/mocks";
import { screen } from "__support__/ui";
import {
  setup,
  type SetupOpts,
  FULL_APP_EMBEDDING_URL,
  EMAIL_URL,
} from "./setup";

const setupPremium = async (opts?: SetupOpts) => {
  await setup({
    ...opts,
    tokenFeatures: createMockTokenFeatures({
      embedding: true,
      advanced_config: true, // TODO figure out if we can define these individually per test
    }),
    hasEnterprisePlugins: true,
  });
};

describe("SettingsEditor", () => {
  describe("full-app embedding", () => {
    it("should allow to configure the origin for full-app embedding", async () => {
      await setupPremium({
        settings: [
          createMockSettingDefinition({ key: "enable-embedding" }),
          createMockSettingDefinition({ key: "embedding-app-origin" }),
        ],
        settingValues: createMockSettings({ "enable-embedding": true }),

        initialRoute: FULL_APP_EMBEDDING_URL,
      });

      expect(screen.getByText("Full-app embedding")).toBeInTheDocument();
      expect(screen.getByText("Authorized origins")).toBeInTheDocument();
      expect(
        screen.queryByText(/some of our paid plans/),
      ).not.toBeInTheDocument();
    });
  });

  describe("subscription allowed domains", () => {
    it("should be visible", async () => {
      await setupPremium({
        settings: [
          createMockSettingDefinition({ key: "subscription-allowed-domains" }),
        ],
        settingValues: createMockSettings({
          "subscription-allowed-domains": "somedomain.com",
        }),
        initialRoute: EMAIL_URL,
      });

      expect(
        screen.getByText(/approved domains for notifications/i),
      ).toBeInTheDocument();
    });
  });

  describe("subscription user visibility", () => {
    it("should be visible", async () => {
      await setupPremium({
        settings: [createMockSettingDefinition({ key: "user-visibility" })],
        settingValues: createMockSettings({ "user-visibility": "all" }),
        initialRoute: EMAIL_URL,
      });

      expect(
        screen.getByText(
          /suggest recipients on dashboard subscriptions and alerts/i,
        ),
      ).toBeInTheDocument();
    });
  });
});
