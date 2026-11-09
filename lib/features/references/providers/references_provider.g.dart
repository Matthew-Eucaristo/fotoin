// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'references_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, type=warning

@ProviderFor(referenceStore)
final referenceStoreProvider = ReferenceStoreProvider._();

final class ReferenceStoreProvider
    extends $FunctionalProvider<ReferenceStore, ReferenceStore, ReferenceStore>
    with $Provider<ReferenceStore> {
  ReferenceStoreProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'referenceStoreProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$referenceStoreHash();

  @$internal
  @override
  $ProviderElement<ReferenceStore> $createElement($ProviderPointer pointer) =>
      $ProviderElement(pointer);

  @override
  ReferenceStore create(Ref ref) {
    return referenceStore(ref);
  }

  /// {@macro riverpod.override_with_value}
  Override overrideWithValue(ReferenceStore value) {
    return $ProviderOverride(
      origin: this,
      providerOverride: $SyncValueProvider<ReferenceStore>(value),
    );
  }
}

String _$referenceStoreHash() => r'67ec2b3d5dfd63210ec558ed8e53ad6248cf0bcf';

@ProviderFor(References)
final referencesProvider = ReferencesProvider._();

final class ReferencesProvider
    extends $AsyncNotifierProvider<References, List<ReferencePhoto>> {
  ReferencesProvider._()
    : super(
        from: null,
        argument: null,
        retry: null,
        name: r'referencesProvider',
        isAutoDispose: false,
        dependencies: null,
        $allTransitiveDependencies: null,
      );

  @override
  String debugGetCreateSourceHash() => _$referencesHash();

  @$internal
  @override
  References create() => References();
}

String _$referencesHash() => r'3946899a996ce3f6ffa287bca00617c1a5036147';

abstract class _$References extends $AsyncNotifier<List<ReferencePhoto>> {
  FutureOr<List<ReferencePhoto>> build();
  @$mustCallSuper
  @override
  WhenComplete runBuild() {
    final ref =
        this.ref
            as $Ref<AsyncValue<List<ReferencePhoto>>, List<ReferencePhoto>>;
    final element =
        ref.element
            as $ClassProviderElement<
              AnyNotifier<
                AsyncValue<List<ReferencePhoto>>,
                List<ReferencePhoto>
              >,
              AsyncValue<List<ReferencePhoto>>,
              Object?,
              Object?
            >;
    return element.handleCreate(ref, build);
  }
}
