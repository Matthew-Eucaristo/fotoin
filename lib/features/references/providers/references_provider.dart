import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../data/reference_store.dart';

part 'references_provider.g.dart';

@Riverpod(keepAlive: true)
ReferenceStore referenceStore(Ref ref) => ReferenceStore();

@Riverpod(keepAlive: true)
class References extends _$References {
  @override
  Future<List<ReferencePhoto>> build() =>
      ref.read(referenceStoreProvider).load();

  Future<ReferencePhoto> add(String path) async {
    final added = await ref.read(referenceStoreProvider).add(path);
    state = AsyncData([added, ...?state.value]);
    return added;
  }

  Future<void> remove(ReferencePhoto photo) async {
    await ref.read(referenceStoreProvider).remove(photo);
    state = AsyncData([...?state.value?.where((r) => r.id != photo.id)]);
  }

  ReferencePhoto? byId(String id) =>
      state.value?.where((r) => r.id == id).firstOrNull;
}
