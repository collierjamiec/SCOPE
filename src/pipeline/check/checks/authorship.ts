import type { CheckDefinition } from '../../types.js';

export const authorshipCheck: CheckDefinition = {
  id: 'geo.authorship',
  name: 'Author/byline and Person schema',
  category: 'geo',
  run: ({ extracted, config }) => {
    const { authorByline, hasPersonSchema } = extracted.content;

    if (!authorByline && !hasPersonSchema) {
      const entityType = config.thresholds.entityEstablishingSchemaTypes.find((type) =>
        extracted.schema.detectedTypes.includes(type),
      );
      if (entityType) {
        return {
          checkId: 'geo.authorship',
          status: 'info',
          detail: `No visible author/byline and no Person schema found, but ${entityType} schema establishes the page's entity — likely fine for non-personally-authored content.`,
          data: { entityType },
        };
      }
      return {
        checkId: 'geo.authorship',
        status: 'fail',
        detail: 'No visible author/byline and no Person schema found.',
      };
    }
    if (authorByline && !hasPersonSchema) {
      return {
        checkId: 'geo.authorship',
        status: 'warn',
        detail: `Visible author/byline ("${authorByline}") is not backed by Person schema.`,
        data: { authorByline },
      };
    }
    if (!authorByline && hasPersonSchema) {
      return {
        checkId: 'geo.authorship',
        status: 'warn',
        detail: 'Person schema present but no visible author/byline on the page.',
      };
    }
    return {
      checkId: 'geo.authorship',
      status: 'pass',
      detail: `Visible author/byline ("${authorByline}") is backed by Person schema.`,
      data: { authorByline },
    };
  },
};
