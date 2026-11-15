/**
 * Framework route adapters (FW-001, ADR 0025). An adapter reads one framework's route
 * declarations from a file's source and its already-indexed declarations, and returns findings;
 * the runner turns them into route nodes and `handled_by` links, so every framework is reported
 * the same way. Adapters never resolve anything at run time and never execute repository code.
 */
import type { Confidence } from '../model';
import type { RuleId } from '../rules';

export interface DeclView {
  key: string;
  /** Qualified name (`OwnerController.findOwner`). */
  name: string;
  kind: string;
  line: number;
}

export interface RouteFinding {
  /** HTTP verb in capitals, or ANY when the mapping accepts every verb. */
  verb: string;
  path: string;
  handlerKey: string;
  line: number;
  confidence: Confidence;
  rule: RuleId;
  detail: string;
}

export interface RouteGap {
  line: number;
  text: string;
  reason: string;
}

export interface RouteAdapter {
  id: string;
  name: string;
  /** Inventory language names the adapter reads. */
  languages: string[];
  /** Cheap check on the file text; only matching files are read. */
  applies(text: string): boolean;
  routes(file: {
    path: string;
    text: string;
    declarations: DeclView[];
    /** Repository string constants (`stringConstants`), for paths written as a constant. */
    constants: Map<string, string>;
  }): {
    routes: RouteFinding[];
    gaps: RouteGap[];
  };
}

/** One file as a repository-level adapter sees it. */
export interface AdapterFile {
  path: string;
  text: string;
  declarations: DeclView[];
}

/**
 * An adapter whose routes need more than one file, such as JAX-RS sub-resource locators that
 * return a resource class declared elsewhere. It sees every file it applies to at once.
 */
export interface RepositoryRouteAdapter {
  id: string;
  name: string;
  languages: string[];
  applies(text: string): boolean;
  repositoryRoutes(
    files: AdapterFile[],
    constants: Map<string, string>,
  ): {
    routes: (RouteFinding & { file: string })[];
    gaps: (RouteGap & { file: string })[];
  };
}
