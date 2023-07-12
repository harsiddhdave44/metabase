import { screen } from "__support__/ui";
import {
  createMockGroup,
  createMockTokenFeatures,
} from "metabase-types/api/mocks";
import { setupGroupsEndpoint } from "__support__/server-mocks";
import { setup, SetupOpts } from "./setup";

const setupPremium = (opts?: SetupOpts) => {
  setupGroupsEndpoint([createMockGroup()]);
  setup({
    ...opts,
    tokenFeatures: createMockTokenFeatures({
      sso: true,
    }),
    hasEnterprisePlugins: true,
  });
};

describe("SettingsEditorApp", () => {
  it("shows JWT and SAML auth options", async () => {
    setupPremium({ initialRoute: "/admin/settings/authentication" });

    expect(await screen.findByText("SAML")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Allows users to login via a SAML Identity Provider.",
      ),
    ).toBeInTheDocument();

    expect(await screen.findByText("JWT")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Allows users to login via a JWT Identity Provider.",
      ),
    ).toBeInTheDocument();
  });

  it("lets users access JWT settings", async () => {
    setupPremium({ initialRoute: "/admin/settings/authentication/jwt" });

    expect(await screen.findByText("Server Settings")).toBeInTheDocument();
    expect(
      await screen.findByText("JWT Identity Provider URI"),
    ).toBeInTheDocument();
  });

  it("lets users access SAML settings", async () => {
    setupPremium({ initialRoute: "/admin/settings/authentication/saml" });

    expect(
      await screen.findByText("Set up SAML-based SSO"),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Configure your identity provider (IdP)"),
    ).toBeInTheDocument();
  });
});
