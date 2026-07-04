import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CategoryStyles, Radii, RoleColors, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-provider';
import {
  activityChildNames,
  fetchActivities,
  fetchTemplates,
  logActivity,
  subscribeToActivities,
  type Activity,
} from '@/lib/activities';
import { fetchChildren, fetchMyFamily, type Child } from '@/lib/families';
import { getActivityMediaUrl, SIGNED_URL_STALE_MS, uploadActivityPhoto } from '@/lib/media';

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

// Compact display for an activity's children: "Jimbo", "Jimbo & Deuxelle",
// or "Jimbo +2" when three or more siblings share one activity.
function childrenLabel(activity: Activity): string | null {
  const names = activityChildNames(activity);
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} +${names.length - 1}`;
}

// Android/Fabric clips the final glyph of a content-sized <Text> (e.g. inside a
// pill that shrink-wraps its label). A trailing non-breaking space keeps its
// advance width — unlike a regular space, which StaticLayout strips — so the
// real last character isn't sitting on the clipped line boundary.
function noClip(label: string): string {
  // String.fromCharCode(160) is a non-breaking space.
  return label + String.fromCharCode(160);
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
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([familyChildren[0].id]);
  const [noteText, setNoteText] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{
    uri: string;
    mimeType: string | null;
  } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({ queryKey: ['activity-templates'], queryFn: fetchTemplates });
  const recentQuery = useQuery({
    queryKey: ['activities', ...selectedChildIds],
    queryFn: () => fetchActivities(selectedChildIds),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  };

  const selectedChildrenKey = selectedChildIds.join(',');
  useEffect(
    () => subscribeToActivities(selectedChildIds, invalidate),
    [selectedChildrenKey]
  );

  // Multi-select: tap toggles a child in/out, but at least one stays selected.
  const toggleChild = (childId: string) => {
    setSelectedChildIds((prev) => {
      if (!prev.includes(childId)) return [...prev, childId];
      return prev.length > 1 ? prev.filter((id) => id !== childId) : prev;
    });
  };

  const logMutation = useMutation({
    // Upload first (if a photo is attached), then insert the activity with the
    // resulting storage path. On failure nothing is inserted and the note +
    // photo stay in place, so the nanny can retry or remove the photo.
    mutationFn: async (params: {
      templateKey: string | null;
      category: string;
      note: string | null;
    }) => {
      const mediaUrls = pendingPhoto
        ? [
            await uploadActivityPhoto({
              familyId: familyChildren[0].family_id,
              localUri: pendingPhoto.uri,
              mimeType: pendingPhoto.mimeType,
            }),
          ]
        : [];
      return logActivity({ childIds: selectedChildIds, loggedBy, mediaUrls, ...params });
    },
    onSuccess: (_activity, params) => {
      const label = params.note ? 'Logged note' : 'Logged';
      setConfirmation(label);
      setPendingPhoto(null);
      setPhotoError(null);
      setTimeout(() => setConfirmation(null), 2000);
      invalidate();
    },
    onError: () => {
      setPhotoError(
        pendingPhoto
          ? 'Upload failed — try again, or remove the photo to log without it.'
          : 'Could not log the activity — please try again.'
      );
    },
  });

  const pickPhoto = async (source: 'library' | 'camera') => {
    setPhotoError(null);
    try {
      const permission =
        source === 'library'
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoError(
          source === 'library'
            ? 'Photo library access is needed to attach a photo.'
            : 'Camera access is needed to take a photo.'
        );
        return;
      }
      // quality 0.7: these are phone photos headed for a mobile feed.
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
      const result =
        source === 'library'
          ? await ImagePicker.launchImageLibraryAsync(options)
          : await ImagePicker.launchCameraAsync(options);
      if (!result.canceled && result.assets[0]) {
        setPendingPhoto({ uri: result.assets[0].uri, mimeType: result.assets[0].mimeType ?? null });
      }
    } catch {
      setPhotoError('Could not open the photo picker.');
    }
  };

  const selectedChild = familyChildren.find((c) => c.id === selectedChildIds[0]);

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <ThemedText type="title">Log an activity</ThemedText>

      {familyChildren.length > 1 ? (
        <>
          <ThemedView style={styles.chipRow}>
            {familyChildren.map((child) => {
              const selected = selectedChildIds.includes(child.id);
              return (
                <Pressable
                  key={child.id}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && { backgroundColor: accent, borderColor: accent },
                    pressed && styles.pressed,
                  ]}
                  onPress={() => toggleChild(child.id)}>
                  <ThemedText style={selected ? styles.chipTextSelected : undefined}>
                    {noClip(child.full_name)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>
          {selectedChildIds.length > 1 ? (
            <ThemedView style={styles.multiChildCue}>
              <MaterialIcons name="group" size={14} color="#687076" />
              <ThemedText style={styles.multiChildCueText}>
                {noClip(`Logging for ${selectedChildIds.length} children`)}
              </ThemedText>
            </ThemedView>
          ) : null}
        </>
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
                  <ThemedText style={styles.templateLabel}>{noClip(template.label)}</ThemedText>
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
        {pendingPhoto ? (
          <View style={styles.photoPreviewRow}>
            <Image
              source={{ uri: pendingPhoto.uri }}
              style={styles.photoPreview}
              contentFit="cover"
            />
            <Pressable
              hitSlop={8}
              disabled={logMutation.isPending}
              onPress={() => {
                setPendingPhoto(null);
                setPhotoError(null);
              }}
              style={({ pressed }) => [styles.photoRemove, pressed && styles.pressed]}>
              <MaterialIcons name="close" size={18} color="#687076" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoButtonRow}>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
              disabled={logMutation.isPending}
              onPress={() => pickPhoto('library')}>
              <MaterialIcons name="photo-library" size={16} color={accent} />
              <ThemedText style={styles.photoButtonText}>{noClip('Add photo')}</ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}
              disabled={logMutation.isPending}
              onPress={() => pickPhoto('camera')}>
              <MaterialIcons name="photo-camera" size={16} color={accent} />
              <ThemedText style={styles.photoButtonText}>{noClip('Camera')}</ThemedText>
            </Pressable>
          </View>
        )}
        {photoError ? (
          <ThemedView style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={18} color="#c23b3b" />
            <ThemedText style={styles.errorText}>{photoError}</ThemedText>
          </ThemedView>
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: accent },
            ((!noteText.trim() && !pendingPhoto) || logMutation.isPending) &&
              styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
          disabled={(!noteText.trim() && !pendingPhoto) || logMutation.isPending}
          onPress={() => {
            logMutation.mutate(
              { templateKey: 'custom', category: 'other', note: noteText.trim() || null },
              { onSuccess: () => setNoteText('') }
            );
          }}>
          {logMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>
              {noteText.trim() || !pendingPhoto ? 'Log note' : 'Log photo'}
            </ThemedText>
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
            <ThemedText style={!categoryFilter ? styles.chipTextSelected : undefined}>
              {noClip('All')}
            </ThemedText>
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
                  {noClip(category)}
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
        const names = childrenLabel(activity);
        return (
          <ThemedView key={activity.id} style={styles.activityCard}>
            <View style={[styles.activityIconBadge, { backgroundColor: color + '22' }]}>
              <MaterialIcons name={icon as never} size={20} color={color} />
            </View>
            <ThemedView style={styles.activityBody}>
              <ThemedText type="defaultSemiBold">
                {activity.activity_templates?.label ?? activity.note ?? activity.category}
                {showChildName && names ? ` · ${names}` : ''}
              </ThemedText>
              {activity.template_key === 'custom' && activity.note ? (
                <ThemedText style={styles.noteText}>{activity.note}</ThemedText>
              ) : null}
              {activity.media_urls.length > 0 ? (
                <View style={styles.photoRow}>
                  {activity.media_urls.map((path) => (
                    <ActivityPhoto key={path} path={path} />
                  ))}
                </View>
              ) : null}
              <ThemedText style={styles.timeText}>{timeAgo(activity.occurred_at)}</ThemedText>
            </ThemedView>
          </ThemedView>
        );
      })}
    </ThemedView>
  );
}

// One photo in an activity card. The bucket is private, so `path` (a storage
// path from media_urls) is resolved to a short-lived signed URL; react-query's
// staleTime plus the module cache in lib/media.ts keep re-signing rare.
// Tapping toggles between thumbnail and full-width — deliberately no gallery.
function ActivityPhoto({ path }: { path: string }) {
  const [expanded, setExpanded] = useState(false);
  const urlQuery = useQuery({
    queryKey: ['activity-media-url', path],
    queryFn: () => getActivityMediaUrl(path),
    staleTime: SIGNED_URL_STALE_MS,
  });

  if (urlQuery.isError) {
    return (
      <View style={[styles.photoThumb, styles.photoPlaceholder]}>
        <MaterialIcons name="broken-image" size={24} color="#9AA1A6" />
      </View>
    );
  }
  if (!urlQuery.data) {
    return <View style={[styles.photoThumb, styles.photoPlaceholder]} />;
  }

  return (
    <Pressable
      style={({ pressed }) => [expanded && styles.photoExpandedWrap, pressed && styles.pressed]}
      onPress={() => setExpanded((value) => !value)}>
      <Image
        source={{ uri: urlQuery.data }}
        style={expanded ? styles.photoExpanded : styles.photoThumb}
        contentFit="cover"
        transition={150}
      />
    </Pressable>
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
  multiChildCue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  multiChildCueText: {
    fontSize: 13,
    opacity: 0.7,
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
  photoButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(104, 112, 118, 0.25)',
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  photoButtonText: {
    fontSize: 14,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: Radii.md,
  },
  photoRemove: {
    padding: Spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(194, 59, 59, 0.10)',
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    color: '#c23b3b',
    flex: 1,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: Radii.md,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(104, 112, 118, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoExpandedWrap: {
    width: '100%',
  },
  photoExpanded: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.md,
  },
  timeText: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
});
