import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryStyles, Radii, RoleColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';
import {
  fetchActivities,
  fetchTemplates,
  logActivity,
  subscribeToActivities,
  type Activity,
} from '@/lib/activities';
import { fetchChildren, fetchMyFamily, type Child } from '@/lib/families';

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function categoryStyle(category: string) {
  return CategoryStyles[category] ?? CategoryStyles.other;
}

// Android/Fabric clips the final glyph of a content-sized <Text> (e.g. inside a
// pill that shrink-wraps its label). A trailing non-breaking space keeps its
// advance width — unlike a regular space, which StaticLayout strips — so the
// real last character isn't sitting on the clipped line boundary.
function noClip(label: string): string {
  return `${label} `;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const accent = profile ? RoleColors[profile.role] : RoleColors.nanny;

  const familyQuery = useQuery({
    queryKey: ['my-family', profile?.id],
    queryFn: () => fetchMyFamily(profile!.role, profile!.id),
    enabled: !!profile,
  });

  const childrenQuery = useQuery({
    queryKey: ['children', familyQuery.data?.id],
    queryFn: () => fetchChildren(familyQuery.data!.id),
    enabled: !!familyQuery.data,
  });

  if (familyQuery.isLoading || childrenQuery.isLoading) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={accent} />
      </ThemedView>
    );
  }

  if (!familyQuery.data) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="home" size={48} color="#9AA1A6" style={styles.emptyIcon} />
        <ThemedText type="title" style={styles.title}>
          No family yet
        </ThemedText>
        <ThemedText style={styles.emptyText}>
          Set up your family in the Family tab first — you&apos;ll see activity logging here once
          there&apos;s a child to log for.
        </ThemedText>
      </ThemedView>
    );
  }

  const children = childrenQuery.data ?? [];
  if (children.length === 0) {
    return (
      <ThemedView style={[styles.center, { paddingTop: insets.top }]}>
        <MaterialIcons name="child-care" size={48} color="#9AA1A6" style={styles.emptyIcon} />
        <ThemedText type="title" style={styles.title}>
          No children yet
        </ThemedText>
        <ThemedText style={styles.emptyText}>
          Add a child in the Family tab to start logging activities.
        </ThemedText>
      </ThemedView>
    );
  }

  return profile?.role === 'nanny' ? (
    <LogActivityScreen familyChildren={children} loggedBy={profile.id} accent={accent} />
  ) : (
    <ActivityFeedScreen familyChildren={children} accent={accent} />
  );
}

function LogActivityScreen({
  familyChildren,
  loggedBy,
  accent,
}: {
  familyChildren: Child[];
  loggedBy: string;
  accent: string;
}) {
  const [selectedChildId, setSelectedChildId] = useState(familyChildren[0].id);
  const [noteText, setNoteText] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({ queryKey: ['activity-templates'], queryFn: fetchTemplates });
  const recentQuery = useQuery({
    queryKey: ['activities', selectedChildId],
    queryFn: () => fetchActivities([selectedChildId]),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activities', selectedChildId] });
  };

  useEffect(() => subscribeToActivities([selectedChildId], invalidate), [selectedChildId]);

  const logMutation = useMutation({
    mutationFn: (params: { templateKey: string | null; category: string; note: string | null }) =>
      logActivity({ childId: selectedChildId, loggedBy, ...params }),
    onSuccess: (_activity, params) => {
      const label = params.note ? 'Logged note' : 'Logged';
      setConfirmation(label);
      setTimeout(() => setConfirmation(null), 2000);
      invalidate();
    },
  });

  const selectedChild = familyChildren.find((c) => c.id === selectedChildId);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ThemedText type="title">Log an activity</ThemedText>

      {familyChildren.length > 1 ? (
        <ThemedView style={styles.chipRow}>
          {familyChildren.map((child) => {
            const selected = selectedChildId === child.id;
            return (
              <Pressable
                key={child.id}
                style={({ pressed }) => [
                  styles.chip,
                  selected && { backgroundColor: accent, borderColor: accent },
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedChildId(child.id)}>
                <ThemedText style={selected ? styles.chipTextSelected : undefined}>
                  {child.full_name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      ) : (
        <ThemedText style={styles.spacer}>{selectedChild?.full_name}</ThemedText>
      )}

      {confirmation ? (
        <ThemedView style={styles.confirmationBanner}>
          <MaterialIcons name="check-circle" size={18} color="#2a9d3f" />
          <ThemedText style={styles.confirmation}>{confirmation}</ThemedText>
        </ThemedView>
      ) : null}

      {templatesQuery.isLoading ? (
        <ActivityIndicator color={accent} style={styles.spacer} />
      ) : (
        <ThemedView style={[styles.templateGrid, styles.spacer]}>
          {templatesQuery.data
            ?.filter((t) => t.key !== 'custom')
            .map((template) => {
              const { icon, color } = categoryStyle(template.category);
              return (
                <Pressable
                  key={template.key}
                  style={({ pressed }) => [styles.templateChip, pressed && styles.pressed]}
                  disabled={logMutation.isPending}
                  onPress={() =>
                    logMutation.mutate({
                      templateKey: template.key,
                      category: template.category,
                      note: null,
                    })
                  }>
                  <View style={[styles.templateIconBadge, { backgroundColor: color + '22' }]}>
                    <MaterialIcons name={icon as never} size={20} color={color} />
                  </View>
                  <ThemedText style={styles.templateLabel}>{template.label}</ThemedText>
                </Pressable>
              );
            })}
        </ThemedView>
      )}

      <ThemedView style={styles.spacer}>
        <TextInput
          style={styles.input}
          placeholder="Something else…"
          placeholderTextColor="#687076"
          value={noteText}
          onChangeText={setNoteText}
        />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: accent },
            (!noteText.trim() || logMutation.isPending) && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          disabled={!noteText.trim() || logMutation.isPending}
          onPress={() => {
            logMutation.mutate(
              { templateKey: 'custom', category: 'other', note: noteText.trim() },
              { onSuccess: () => setNoteText('') }
            );
          }}>
          {logMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Log note</ThemedText>
          )}
        </Pressable>
      </ThemedView>

      <ThemedText type="subtitle" style={styles.spacer}>
        Recent
      </ThemedText>
      <ActivityList activities={recentQuery.data ?? []} showChildName={false} />
    </ScrollView>
  );
}

function ActivityFeedScreen({
  familyChildren,
  accent,
}: {
  familyChildren: Child[];
  accent: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const childIds = familyChildren.map((c) => c.id);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const activitiesQuery = useQuery({
    queryKey: ['activities', ...childIds],
    queryFn: () => fetchActivities(childIds),
  });

  useEffect(
    () =>
      subscribeToActivities(childIds, () =>
        queryClient.invalidateQueries({ queryKey: ['activities', ...childIds] })
      ),
    [childIds.join(',')]
  );

  const categories = Array.from(new Set(activitiesQuery.data?.map((a) => a.category) ?? []));
  const filtered = categoryFilter
    ? (activitiesQuery.data ?? []).filter((a) => a.category === categoryFilter)
    : activitiesQuery.data ?? [];

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ThemedText type="title">Activity feed</ThemedText>

      {categories.length > 0 ? (
        <ThemedView style={[styles.chipRow, styles.spacer]}>
          <Pressable
            style={({ pressed }) => [
              styles.chip,
              !categoryFilter && { backgroundColor: accent, borderColor: accent },
              pressed && styles.pressed,
            ]}
            onPress={() => setCategoryFilter(null)}>
            <ThemedText style={!categoryFilter ? styles.chipTextSelected : undefined}>All</ThemedText>
          </Pressable>
          {categories.map((category) => {
            const selected = categoryFilter === category;
            const { icon, color } = categoryStyle(category);
            return (
              <Pressable
                key={category}
                style={({ pressed }) => [
                  styles.chip,
                  styles.categoryChip,
                  selected && { backgroundColor: color, borderColor: color },
                  pressed && styles.pressed,
                ]}
                onPress={() => setCategoryFilter(category)}>
                <MaterialIcons
                  name={icon as never}
                  size={14}
                  color={selected ? '#fff' : color}
                />
                <ThemedText style={selected ? styles.chipTextSelected : undefined}>
                  {category}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      ) : null}

      {activitiesQuery.isLoading ? (
        <ActivityIndicator color={accent} style={styles.spacer} />
      ) : (
        <ActivityList activities={filtered} showChildName={familyChildren.length > 1} />
      )}
    </ScrollView>
  );
}

function ActivityList({
  activities,
  showChildName,
}: {
  activities: Activity[];
  showChildName: boolean;
}) {
  if (activities.length === 0) {
    return (
      <ThemedView style={[styles.center, styles.spacer]}>
        <MaterialIcons name="auto-stories" size={40} color="#9AA1A6" style={styles.emptyIcon} />
        <ThemedText style={styles.emptyText}>No activities logged yet.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.spacer}>
      {activities.map((activity) => {
        const { icon, color } = categoryStyle(activity.category);
        return (
          <ThemedView key={activity.id} style={styles.activityCard}>
            <View style={[styles.activityIconBadge, { backgroundColor: color + '22' }]}>
              <MaterialIcons name={icon as never} size={20} color={color} />
            </View>
            <ThemedView style={styles.activityBody}>
              <ThemedText type="defaultSemiBold">
                {activity.activity_templates?.label ?? activity.note ?? activity.category}
                {showChildName && activity.children ? ` · ${activity.children.full_name}` : ''}
              </ThemedText>
              {activity.template_key === 'custom' && activity.note ? (
                <ThemedText style={styles.noteText}>{activity.note}</ThemedText>
              ) : null}
              <ThemedText style={styles.timeText}>{timeAgo(activity.occurred_at)}</ThemedText>
            </ThemedView>
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    marginBottom: Spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  spacer: {
    marginTop: Spacing.lg,
  },
  confirmationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    backgroundColor: 'rgba(42, 157, 63, 0.12)',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  confirmation: {
    color: '#2a9d3f',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Spacing.sm,
  },
  button: {
    borderRadius: Radii.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(104, 112, 118, 0.25)',
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  templateIconBadge: {
    width: 32,
    height: 32,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateLabel: {
    fontSize: 14,
  },
  activityCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    backgroundColor: 'rgba(104, 112, 118, 0.06)',
    marginBottom: Spacing.sm,
  },
  activityIconBadge: {
    width: 40,
    height: 40,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBody: {
    flex: 1,
    gap: 2,
  },
  noteText: {
    opacity: 0.8,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
});
