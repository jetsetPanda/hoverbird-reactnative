import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/contexts/auth-provider';
import { addChild, createFamily, fetchChildren, fetchMyFamily } from '@/lib/families';

function formatAge(birthdate: string | null): string | null {
  if (!birthdate) return null;
  const months = Math.floor(
    (Date.now() - new Date(birthdate).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
  );
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr`;
}

export default function FamilyScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

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

  if (familyQuery.isLoading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!familyQuery.data) {
    if (profile?.role === 'nanny') {
      return (
        <ThemedView style={styles.center}>
          <ThemedText type="title" style={styles.title}>
            No family yet
          </ThemedText>
          <ThemedText style={styles.centerText}>
            You haven&apos;t been added to a family yet. Ask a parent for an invite code once
            invitations are set up.
          </ThemedText>
        </ThemedView>
      );
    }
    return <CreateFamilyForm onCreated={() => familyQuery.refetch()} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">{familyQuery.data.name}</ThemedText>

      {childrenQuery.isLoading ? (
        <ActivityIndicator style={styles.spacer} />
      ) : (
        <ThemedView style={styles.spacer}>
          {childrenQuery.data?.length ? (
            childrenQuery.data.map((child) => (
              <ThemedView key={child.id} style={styles.childRow}>
                <ThemedText type="defaultSemiBold">{child.full_name}</ThemedText>
                {formatAge(child.birthdate) ? (
                  <ThemedText>{formatAge(child.birthdate)}</ThemedText>
                ) : null}
              </ThemedView>
            ))
          ) : (
            <ThemedText>No children added yet.</ThemedText>
          )}
        </ThemedView>
      )}

      {profile?.role === 'parent' ? (
        <AddChildForm
          familyId={familyQuery.data.id}
          onAdded={() => queryClient.invalidateQueries({ queryKey: ['children', familyQuery.data!.id] })}
        />
      ) : null}
    </ScrollView>
  );
}

function CreateFamilyForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createFamily(name.trim()),
    onSuccess: onCreated,
    onError: (err: Error) => setError(err.message),
  });

  return (
    <ThemedView style={styles.center}>
      <ThemedText type="title" style={styles.title}>
        Create your family
      </ThemedText>
      <ThemedText style={styles.centerText}>
        Give your household a name. You can add children and invite caregivers next.
      </ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Family name"
        placeholderTextColor="#687076"
        value={name}
        onChangeText={setName}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, (!name.trim() || mutation.isPending) && styles.buttonDisabled]}
        disabled={!name.trim() || mutation.isPending}
        onPress={() => {
          setError(null);
          mutation.mutate();
        }}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Create family</ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

function AddChildForm({ familyId, onAdded }: { familyId: string; onAdded: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => addChild(familyId, fullName.trim(), birthdate.trim() || null),
    onSuccess: () => {
      setFullName('');
      setBirthdate('');
      setIsOpen(false);
      onAdded();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!isOpen) {
    return (
      <Pressable style={[styles.button, styles.spacer]} onPress={() => setIsOpen(true)}>
        <ThemedText style={styles.buttonText}>+ Add child</ThemedText>
      </Pressable>
    );
  }

  return (
    <ThemedView style={styles.spacer}>
      <TextInput
        style={styles.input}
        placeholder="Child's name"
        placeholderTextColor="#687076"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        style={styles.input}
        placeholder="Birthdate YYYY-MM-DD (optional)"
        placeholderTextColor="#687076"
        value={birthdate}
        onChangeText={setBirthdate}
      />

      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

      <Pressable
        style={[styles.button, (!fullName.trim() || mutation.isPending) && styles.buttonDisabled]}
        disabled={!fullName.trim() || mutation.isPending}
        onPress={() => {
          setError(null);
          mutation.mutate();
        }}>
        {mutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Save child</ThemedText>
        )}
      </Pressable>
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
  centerText: {
    marginBottom: 8,
  },
  title: {
    marginBottom: 4,
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
  error: {
    color: '#d33',
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
  spacer: {
    marginTop: 16,
  },
  childRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
});
