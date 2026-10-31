/**
 * @module testing
 * Shared joined-tree fixture for pure layout and mounted UI tests.
 * Called by: joined skill-tree tests. Calls: createConfig.
 */
import { createConfig } from '../core';
import { num } from '../numbers';
import { testConfig } from './testConfig';

/**
 * Builds a trunk with independent single-row branches using the test configuration.
 * Called by: joined skill-tree tests. Calls: createConfig.
 * @param count Number of coloured branches.
 * @returns Valid game configuration with cross-branch parents.
 */
export function joinedTreeConfig(count: number) {
  return createConfig(testConfig, {
    buyables: [
      ...testConfig.buyables,
      ...Array.from({ length: count + 1 }, (_, index) => ({
        id: `joined${index}`,
        name: `Joined ${index}`,
        description: '',
        symbol: `J${index}`,
        branch: index === 0 ? 'sleeveUp' : `path${index}`,
        currency: 'resleevePoints' as const,
        cost: num(1),
        effect: { kind: 'placeholder' as const },
        ...(index === 0 ? {} : { parents: ['joined0'] }),
      })),
    ],
  });
}
