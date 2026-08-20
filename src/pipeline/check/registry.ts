import type { CheckDefinition } from '../types.js';
import { blockedPageCheck } from './checks/blockedPage.js';
import { mobileEmulationFallbackCheck } from './checks/mobileEmulationFallback.js';
import { headingStructureCheck } from './checks/headingStructure.js';
import { titleLengthCheck, metaDescriptionCheck } from './checks/metaTags.js';
import { altTextCheck } from './checks/altText.js';
import { imageFormatCheck } from './checks/imageFormat.js';
import { imageFilenameCheck } from './checks/imageFilename.js';
import { imageDimensionsCheck } from './checks/imageDimensions.js';
import { canonicalCheck } from './checks/canonical.js';
import { indexabilityCheck } from './checks/indexability.js';
import { schemaPresenceCheck } from './checks/schemaPresence.js';
import { brokenLinksCheck } from './checks/brokenLinks.js';
import { consoleErrorsCheck } from './checks/consoleErrors.js';
import { performanceCheck } from './checks/performance.js';
import { anchorTextCheck } from './checks/anchorText.js';
import { llmsTxtCheck } from './checks/llmsTxt.js';
import { authorshipCheck } from './checks/authorship.js';
import { outboundLinksCheck } from './checks/outboundLinks.js';
import { contentStructureCheck } from './checks/contentStructure.js';

/**
 * The single extension point for v1 checks: add a new file under `checks/`
 * exporting a CheckDefinition, then add it here. No other file needs to change.
 */
export const CHECK_REGISTRY: CheckDefinition[] = [
  blockedPageCheck,
  mobileEmulationFallbackCheck,
  headingStructureCheck,
  titleLengthCheck,
  metaDescriptionCheck,
  altTextCheck,
  imageFormatCheck,
  imageFilenameCheck,
  imageDimensionsCheck,
  canonicalCheck,
  indexabilityCheck,
  schemaPresenceCheck,
  brokenLinksCheck,
  consoleErrorsCheck,
  performanceCheck,
  anchorTextCheck,
  llmsTxtCheck,
  authorshipCheck,
  outboundLinksCheck,
  contentStructureCheck,
];
