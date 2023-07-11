/* istanbul ignore file */
import { IndexRedirect, Route } from "react-router";
import { SettingDefinition, Settings, TokenFeatures } from "metabase-types/api";
import {
  createMockSettings,
  createMockTokenFeatures,
} from "metabase-types/api/mocks";
import { createMockState } from "metabase-types/store/mocks";
import { setupEnterprisePlugins } from "__support__/enterprise";
import {
  setupPropertiesEndpoints,
  setupSettingsEndpoints,
} from "__support__/server-mocks";
import { mockSettings } from "__support__/settings";
import { renderWithProviders, screen, waitFor } from "__support__/ui";
import SettingsEditor from "../SettingsEditor";

export const FULL_APP_EMBEDDING_URL =
  "/admin/settings/embedding-in-other-applications/full-app";
export const EMAIL_URL = "/admin/settings/email";

export interface SetupOpts {
  initialRoute?: string;
  settings?: SettingDefinition[];
  settingValues?: Settings;
  tokenFeatures?: TokenFeatures;
  hasEnterprisePlugins?: boolean;
}

export const setup = async ({
  initialRoute = "/admin/settings",
  settings = [],
  settingValues = createMockSettings(),
  tokenFeatures = createMockTokenFeatures(),
  hasEnterprisePlugins = false,
}: SetupOpts = {}) => {
  const state = createMockState({
    settings: mockSettings({
      ...settingValues,
      "token-features": tokenFeatures,
    }),
  });

  if (hasEnterprisePlugins) {
    setupEnterprisePlugins();
  }

  setupSettingsEndpoints(settings);
  setupPropertiesEndpoints(settingValues);

  renderWithProviders(
    <Route path="/admin/settings">
      <IndexRedirect to="general" />
      <Route path="*" component={SettingsEditor} />
    </Route>,
    {
      storeInitialState: state,
      withRouter: true,
      initialRoute,
    },
  );

  await waitFor(() => screen.getByText(/general/i));
};
