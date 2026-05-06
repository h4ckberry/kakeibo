import { ParameterManagerClient } from '@google-cloud/parametermanager';
import { parse } from 'yaml';
import type { UserConfig } from '../types';
import { UserConfigArraySchema } from '../types';

const PARAMETER_LOCATION_PATTERN = /\/locations\/([^/]+)\//;

export function parseUserConfigsYaml(yaml: string): UserConfig[] {
  return UserConfigArraySchema.parse(parse(yaml));
}

export function buildParameterVersionName(
  parameterName: string,
  version: string,
): string {
  return `${parameterName}/versions/${version}`;
}

export function decodeParameterPayload(
  payload: Uint8Array | string | null | undefined,
): string {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload instanceof Uint8Array) {
    return new TextDecoder().decode(payload);
  }

  throw new Error('Parameter Manager user config payload is empty');
}

function createParameterManagerClient(
  parameterName: string,
): ParameterManagerClient {
  const location = PARAMETER_LOCATION_PATTERN.exec(parameterName)?.[1];
  if (!location || location === 'global') {
    return new ParameterManagerClient();
  }

  return new ParameterManagerClient({
    apiEndpoint: `parametermanager.${location}.rep.googleapis.com`,
  });
}

export async function loadUserConfigs(
  parameterName: string,
  version: string,
): Promise<UserConfig[]> {
  const client = createParameterManagerClient(parameterName);
  const name = buildParameterVersionName(parameterName, version);
  const [response] = await client.renderParameterVersion({ name });
  const yaml = decodeParameterPayload(response.renderedPayload);

  return parseUserConfigsYaml(yaml);
}
