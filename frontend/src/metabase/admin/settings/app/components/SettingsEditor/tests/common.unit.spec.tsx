import userEvent from "@testing-library/user-event";
import {
  createMockSettingDefinition,
  createMockSettings,
} from "metabase-types/api/mocks";
import { screen } from "__support__/ui";
import { setup } from "./setup";

describe("SettingsEditor", () => {
  describe("full-app embedding", () => {
    it("should show info about full app embedding", async () => {
      setup({
        settings: [createMockSettingDefinition({ key: "enable-embedding" })],
        settingValues: createMockSettings({ "enable-embedding": true }),
      });

      userEvent.click(await screen.findByText("Embedding"));
      userEvent.click(screen.getByText("Full-app embedding"));
      expect(screen.getByText(/some of our paid plans/)).toBeInTheDocument();
      expect(screen.queryByText("Authorized origins")).not.toBeInTheDocument();
    });
  });

  describe("authentication settings", function () {
    it("should not show JWT and SAML auth options", async () => {
      setup({ initialRoute: "/admin/settings/authentication" });

      expect(
        await screen.findByText("Sign in with Google"),
      ).toBeInTheDocument();

      expect(screen.queryByText("SAML")).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Allows users to login via a SAML Identity Provider.",
        ),
      ).not.toBeInTheDocument();

      expect(screen.queryByText("JWT")).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "Allows users to login via a JWT Identity Provider.",
        ),
      ).not.toBeInTheDocument();
    });

    it("should not let users access JWT settings", async () => {
      setup({
        initialRoute: "/admin/settings/authentication/jwt",
      });

      expect(
        await screen.findByText("We're a little lost..."),
      ).toBeInTheDocument();
    });

    it("should not let users access SAML settings", async () => {
      setup({
        initialRoute: "/admin/settings/authentication/saml",
      });

      expect(
        await screen.findByText("We're a little lost..."),
      ).toBeInTheDocument();
    });
  });
});
