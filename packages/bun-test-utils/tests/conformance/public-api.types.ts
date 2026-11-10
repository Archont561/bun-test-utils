import type {
  GivenChain,
  GivenStep,
  ScenarioContext,
  ThenStep,
  WhenStep,
} from "@archont561/bun-test-utils/bdd";
import type {
  ArbitraryInput,
  FastCheckApi,
  GeneratedValues,
} from "@archont561/bun-test-utils/pbt";
import type { Arbitrary } from "fast-check";

// Positive assertions pin the runtime helper name and related types to the PBT subpath.
type _DefineArbitrariesIsExported =
  typeof import("@archont561/bun-test-utils/pbt").defineArbitraries;
type _OldPbtName =
  // @ts-expect-error The pre-release propTestSchema name has been removed.
  typeof import("@archont561/bun-test-utils/pbt").propTestSchema;

type _PbtAliasesAreExported = [
  FastCheckApi,
  ArbitraryInput<{ value: Arbitrary<string> }>,
  GeneratedValues<{ value: Arbitrary<string> }>,
];
type _BddAliasesAreExported = [
  GivenChain,
  GivenStep,
  WhenStep,
  ThenStep,
  ScenarioContext,
];

// @ts-expect-error PBT type helpers are available only from @archont561/bun-test-utils/pbt.
import type { FastCheckApi as RootFastCheckApi } from "@archont561/bun-test-utils";

type _RootFastCheckApiMustBeUnavailable = RootFastCheckApi;

// @ts-expect-error PBT type helpers are available only from @archont561/bun-test-utils/pbt.
import type { ArbitraryInput as RootArbitraryInput } from "@archont561/bun-test-utils";

type _RootArbitraryInputMustBeUnavailable = RootArbitraryInput<{
  value: Arbitrary<string>;
}>;

// @ts-expect-error PBT type helpers are available only from @archont561/bun-test-utils/pbt.
import type { GeneratedValues as RootGeneratedValues } from "@archont561/bun-test-utils";

type _RootGeneratedValuesMustBeUnavailable = RootGeneratedValues<{
  value: Arbitrary<string>;
}>;

// @ts-expect-error Scenario step types are available only from @archont561/bun-test-utils/bdd.
import type { GivenChain as RootGivenChain } from "@archont561/bun-test-utils";

type _RootGivenChainMustBeUnavailable = RootGivenChain;

// @ts-expect-error Scenario step types are available only from @archont561/bun-test-utils/bdd.
import type { ScenarioContext as RootScenarioContext } from "@archont561/bun-test-utils";

type _RootScenarioContextMustBeUnavailable = RootScenarioContext;

// @ts-expect-error Scenario step types are available only from @archont561/bun-test-utils/bdd.
import type { GivenStep as RootGivenStep } from "@archont561/bun-test-utils";

type _RootGivenStepMustBeUnavailable = RootGivenStep;

// @ts-expect-error Scenario step types are available only from @archont561/bun-test-utils/bdd.
import type { WhenStep as RootWhenStep } from "@archont561/bun-test-utils";

type _RootWhenStepMustBeUnavailable = RootWhenStep;

// @ts-expect-error Scenario step types are available only from @archont561/bun-test-utils/bdd.
import type { ThenStep as RootThenStep } from "@archont561/bun-test-utils";

type _RootThenStepMustBeUnavailable = RootThenStep;

// Positive assertion pins the cassette serializer contract to the VCR subpath.
import type { CallbackSerializer } from "@archont561/bun-test-utils/vcr";

type _DefineCallbackSerializerIsExported =
  typeof import("@archont561/bun-test-utils/vcr").defineCallbackSerializer;
type _RegisterCallbackSerializerIsExported =
  typeof import("@archont561/bun-test-utils/vcr").registerCallbackSerializer;
type _UnregisterCallbackSerializerIsExported =
  typeof import("@archont561/bun-test-utils/vcr").unregisterCallbackSerializer;

type _CallbackSerializerIsUsable = CallbackSerializer<Date>;

// @ts-expect-error Cassette serializer types are available only from @archont561/bun-test-utils/vcr.
import type { CallbackSerializer as RootCallbackSerializer } from "@archont561/bun-test-utils";

type _RootCallbackSerializerMustBeUnavailable = RootCallbackSerializer;

// Positive assertion: the public runner carries Bun's modifier surface
// (ADR 0043), so a consumer never needs `bun:test`'s runner for skip/only/todo.
type _ModifiersAreTyped = [
  typeof import("@archont561/bun-test-utils").test.skip,
  typeof import("@archont561/bun-test-utils").test.only,
  typeof import("@archont561/bun-test-utils").test.skipIf,
];

// @ts-expect-error `test.each` is not part of the surface until a row/context
// convention is decided (ADR 0043).
type _EachIsAbsent = typeof import("@archont561/bun-test-utils").test.each;

// Positive assertion: `tags` is accepted on the runner's options object
// (ADR 0044), alongside the existing per-test options.
type _TagsAreAccepted = Parameters<
  typeof import("@archont561/bun-test-utils").test
>[2];
const _taggedOptions: _TagsAreAccepted = {
  tags: ["fast", "filesystem"],
  timeout: 1000,
};
