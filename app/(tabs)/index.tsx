import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-provider';
import { fetchActivities, fetchTemplates, logActivity, type Activity } from '@/lib/activities';
import { fetchChildren, fetchMyFamily, type Child } from '@/lib/families';

function timeAgo(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HomeScreen() {
  const { profile } = useAuth();

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
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!familyQuery.data) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="title" style={styles.title}>
          No family yet
        </ThemedText>
        <ThemedText>
          Set up your family in the Family tab first — you&apos;ll see activity logging here once
          there&apos;s a child to log for.
        </ThemedText>
      </ThemedView>
    );
  }

  const children = childrenQuery.data ?? [];
  if (children.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="title" style={styles.title}>
          No children yet
        </ThemedText>
        <ThemedText>Add a child in the Family tab to start logging activities.</ThemedText>
      </ThemedView>
    );
  }

  return profile?.role === 'nanny' ? (
    <LogActivityScreen familyChildren={children} loggedBy={profile.id} />
  ) : (
    <ActivityFeedScreen familyChildren={children} />
  );
}

function LogActivityScreen({
  familyChildren,
  loggedBy,
}: {
  familyChildren: Child[];
  loggedBy: string;
}) {
  const [selectedChildId, setSelectedChildId] = useState(familyChildren[0].id);
  const [noteText, setNoteText] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({ queryKey: ['activity-templates'], queryFn: fetchTemplates });
  const recentQuery = useQuery({
    queryKey: ['activities', selectedChildId],
    queryFn: () => fetchActivities([selectedChildId]),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activities', selectedChildId] });
  };

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
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Log an activity</ThemedText>

      {familyChildren.length > 1 ? (
        <ThemedView style={styles.chipRow}>
          {familyChildren.map((child) => (
            <Pressable
              key={child.id}
              style={[styles.chip, selectedChildId === child.id && styles.chipSelected]}
              onPress={() => setSelectedChildId(child.id)}>
              <ThemedText style={selectedChildId === child.id ? styles.chipTextSelected : undefined}>
                {child.full_name}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      ) : (
        <ThemedText style={styles.spacer}>{selectedChild?.full_name}</ThemedText>
      )}

      {confirmation ? <ThemedText style={styles.confirmation}>✓ {confirmation}</ThemedText> : null}

      {templatesQuery.isLoading ? (
        <ActivityIndicator style={styles.spacer} />
      ) : (
        <ThemedView style={[styles.chipRow, styles.spacer]}>
          {templatesQuery.data
            ?.filter((t) => t.key !== 'custom')
            .map((template) => (
              <Pressable
                key={template.key}
                style={styles.templateChip}
                disabled={logMutation.isPending}
                onPress={() =>
                  logMutation.mutate({
                    templateKey: template.key,
                    category: template.category,
                    note: null,
                  })
                }>
                <ThemedText>{template.label}</ThemedText>
              </Pressable>
            ))}
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
          style={[styles.button, (!noteText.trim() || logMutation.isPending) && styles.buttonDisabled]}
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

function ActivityFeedScreen({ familyChildren }: { familyChildren: Child[] }) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const childIds = familyChildren.map((c) => c.id);

  const activitiesQuery = useQuery({
    queryKey: ['activities', ...childIds],
    queryFn: () => fetchActivities(childIds),
  });

  const categories = Array.from(new Set(activitiesQuery.data?.map((a) => a.category) ?? []));
  const filtered = categoryFilter
    ? (activitiesQuery.data ?? []).filter((a) => a.category === categoryFilter)
    : activitiesQuery.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">Activity feed</ThemedText>

      {categories.length > 0 ? (
        <ThemedView style={[styles.chipRow, styles.spacer]}>
          <Pressable
            style={[styles.chip, !categoryFilter && styles.chipSelected]}
            onPress={() => setCategoryFilter(null)}>
            <ThemedText style={!categoryFilter ? styles.chipTextSelected : undefined}>All</ThemedText>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category}
              style={[styles.chip, categoryFilter === category && styles.chipSelected]}
              onPress={() => setCategoryFilter(category)}>
              <ThemedText style={categoryFilter === category ? styles.chipTextSelected : undefined}>
                {category}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>
      ) : null}

      {activitiesQuery.isLoading ? (
        <ActivityIndicator style={styles.spacer} />
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
    return <ThemedText style={styles.spacer}>No activities logged yet.</ThemedText>;
  }

  return (
    <ThemedView style={styles.spacer}>
      {activities.map((activity) => (
        <ThemedView key={activity.id} style={styles.activityRow}>
          <ThemedText type="defaultSemiBold">
            {activity.activity_templates?.label ?? activity.note ?? activity.category}
            {showChildName && activity.children ? ` · ${activity.children.full_name}` : ''}
          </ThemedText>
          {activity.template_key === 'custom' && activity.note ? (
            <ThemedText>{activity.note}</ThemedText>
          ) : null}
          <ThemedText style={styles.timeText}>{timeAgo(activity.occurred_at)}</ThemedText>
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    marginBottom: 4,
  },
  spacer: {
    marginTop: 16,
  },
  confirmation: {
    color: '#2a9d3f',
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#687076',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  templateChip: {
    borderWidth: 1,
    borderColor: '#0a7ea4',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  activityRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
