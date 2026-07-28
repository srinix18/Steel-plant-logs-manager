import { type ReactElement, type ReactNode } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/src/theme/tokens';
import {
  LIST_VIRTUALIZE_THRESHOLD,
  shouldVirtualizeList,
} from '@/src/components/ui/virtualListConfig';

export { LIST_VIRTUALIZE_THRESHOLD, shouldVirtualizeList };

type Props<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  /** Title, filters, banners — scrolls with the list. */
  header?: ReactNode;
  empty?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Extra rows after the main list (e.g. short secondary sections). */
  footer?: ReactNode;
};

/**
 * Virtualized screen list (FlatList). Prefer over Screen+map for queues that can
 * grow past {@link LIST_VIRTUALIZE_THRESHOLD} (My Runs, WO, employees).
 * Run-host stays on Screen scroll — one card at a time (P6-PERF).
 */
export function VirtualList<T>({
  data,
  keyExtractor,
  renderItem,
  header,
  empty,
  refreshing = false,
  onRefresh,
  padded = true,
  edges = ['bottom'],
  contentContainerStyle,
  footer,
}: Props<T>): ReactElement {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={header ? <>{header}</> : null}
        ListEmptyComponent={empty ? <>{empty}</> : null}
        ListFooterComponent={footer ? <>{footer}</> : null}
        contentContainerStyle={[
          padded && styles.padded,
          data.length === 0 && styles.grow,
          contentContainerStyle,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
            />
          ) : undefined
        }
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  padded: { padding: spacing.md },
  grow: { flexGrow: 1 },
});
