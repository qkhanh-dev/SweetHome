import fixtures from "./fixtures.json";

export const MOCK_DELAY_MS = 200;

export const mockData = fixtures;

export type MockFixtureKey = keyof typeof mockData;

export async function getMockResponse<K extends MockFixtureKey>(
  key: K,
): Promise<(typeof mockData)[K]> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, MOCK_DELAY_MS);
  });

  const response = structuredClone(mockData[key]);

  response.timestamp = new Date().toISOString();

  return response;
}
