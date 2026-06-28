import { describe, expect, it } from 'vitest'

import {
  readConfiguredProjectIds,
  readConfiguredProjectSlugs,
  resolveSentryProjectSelection,
} from '@bitsentry-ce/core/features/error-sources'

const projects = [
  { id: '101', slug: 'alpha-api', name: 'Alpha API' },
  { id: '202', slug: 'beta-worker', name: 'Beta Worker' },
  { id: '303', slug: 'gamma-web', name: 'Gamma Web' },
]

describe('sentry project selection', () => {
  it('normalizes configured ids and slugs', () => {
    expect(
      readConfiguredProjectIds({
        projectIds: ['101', ' 202 ', 'invalid', '202', '', null],
      }),
    ).toEqual(['101', '202'])

    expect(
      readConfiguredProjectSlugs({
        projectSlugs: ['alpha-api', ' beta-worker ', 'alpha-api', '', null],
      }),
    ).toEqual(['alpha-api', 'beta-worker'])
  })

  it('resolves selected projects by ids and reports missing ids', () => {
    expect(
      resolveSentryProjectSelection(projects, {
        projectIds: ['202', '999', '101'],
        projectSlugs: ['gamma-web'],
      }),
    ).toEqual({
      projectIds: ['202', '999', '101'],
      projectSlugs: ['beta-worker', 'alpha-api'],
      projectNames: ['Beta Worker', 'Alpha API'],
      missingProjectIds: ['999'],
      missingProjectSlugs: [],
    })
  })

  it('falls back to slug selection and can default to all projects', () => {
    expect(
      resolveSentryProjectSelection(projects, {
        projectSlugs: ['gamma-web', 'missing-slug', 'alpha-api'],
      }),
    ).toEqual({
      projectIds: ['303', '101'],
      projectSlugs: ['gamma-web', 'alpha-api'],
      projectNames: ['Gamma Web', 'Alpha API'],
      missingProjectIds: [],
      missingProjectSlugs: ['missing-slug'],
    })

    expect(
      resolveSentryProjectSelection(projects, {
        defaultToAll: true,
      }),
    ).toEqual({
      projectIds: ['101', '202', '303'],
      projectSlugs: ['alpha-api', 'beta-worker', 'gamma-web'],
      projectNames: ['Alpha API', 'Beta Worker', 'Gamma Web'],
      missingProjectIds: [],
      missingProjectSlugs: [],
    })
  })
})
