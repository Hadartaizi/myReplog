import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../../../database/firebase';
import {
  formatDateTimeIL,
  getRemainingTimeLabel,
} from './accessUtils';

type ApprovalStatus = 'pending' | 'approved' | 'blocked';

type ClientItem = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  approvalStatus?: ApprovalStatus;
  accessStartAt?: string | null;
  accessEndAt?: string | null;
  role?: 'admin' | 'client';
};

type Props = {
  onAfterUpdate?: () => Promise<void> | void;
};

type SelectedAction = 'extend' | 'reduce' | 'unlimited' | 'toggleBlock';

const normalizeStatus = (status?: string | null): ApprovalStatus => {
  const clean = String(status ?? '').trim().toLowerCase();

  if (clean === 'approved') return 'approved';
  if (clean === 'blocked') return 'blocked';

  return 'pending';
};

const isClientLikeUser = (user: ClientItem) => {
  if (user.role === 'admin') return false;
  return true;
};

export default function ClientAccessManager({ onAfterUpdate }: Props) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState('30');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedAction, setSelectedAction] =
    useState<SelectedAction>('extend');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const confirmAction = async (title: string, message: string) => {
    if (Platform.OS === 'web') {
      return window.confirm(`${title}\n\n${message}`);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        {
          text: 'ביטול',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'אישור',
          style: 'destructive',
          onPress: () => resolve(true),
        },
      ]);
    });
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        const nextClients: ClientItem[] = snapshot.docs
          .map((item) => {
            const data = item.data() as Omit<ClientItem, 'id'>;

            return {
              id: item.id,
              uid: data.uid,
              name: data.name,
              email: data.email,
              approvalStatus: normalizeStatus(data.approvalStatus),
              accessStartAt: data.accessStartAt ?? null,
              accessEndAt: data.accessEndAt ?? null,
              role: data.role,
            };
          })
          .filter(isClientLikeUser);

        setClients(nextClients);

        setSelectedClientId((prev) => {
          if (!prev) return prev;
          const stillExists = nextClients.some((client) => client.id === prev);
          return stillExists ? prev : null;
        });

        setLoadingClients(false);
      },
      (error) => {
        console.error('שגיאה בטעינת לקוחות:', error);
        setLoadingClients(false);
        showMessage('שגיאה', 'לא ניתן לטעון את רשימת הלקוחות');
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const pendingClients = useMemo(
    () => clients.filter((client) => client.approvalStatus === 'pending'),
    [clients]
  );

  const getValidDays = () => {
    const value = daysInput.trim();

    if (!value) {
      showMessage('שגיאה', 'יש להזין מספר ימים תקין');
      return null;
    }

    const days = Number(value);

    if (!Number.isFinite(days) || days <= 0) {
      showMessage('שגיאה', 'יש להזין מספר ימים תקין');
      return null;
    }

    return days;
  };

  const approveClientById = async (clientId: string) => {
    const days = getValidDays();
    if (!days) return;

    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);

    try {
      setSavingId(clientId);

      await updateDoc(doc(db, 'users', clientId), {
        approvalStatus: 'approved',
        role: 'client',
        accessStartAt: startAt.toISOString(),
        accessEndAt: endAt.toISOString(),
        approvedAt: new Date().toISOString(),
      });

      await onAfterUpdate?.();

      showMessage(
        'הצלחה',
        `הלקוח אושר בהצלחה.\nתוקף הגישה עד ${formatDateTimeIL(endAt.toISOString())}`
      );
    } catch (error) {
      console.error('שגיאה באישור לקוח:', error);
      showMessage('שגיאה', 'לא ניתן לאשר את הלקוח');
    } finally {
      setSavingId(null);
    }
  };

  const deletePendingClientById = async (clientId: string) => {
    const confirmed = await confirmAction(
      'מחיקת בקשה',
      'האם את בטוחה שברצונך למחוק לגמרי את בקשת הלקוח? פעולה זו תמחק את מסמך המשתמש מ־Firestore.'
    );

    if (!confirmed) return;

    try {
      setSavingId(clientId);

      await deleteDoc(doc(db, 'users', clientId));

      if (selectedClientId === clientId) {
        setSelectedClientId(null);
      }

      await onAfterUpdate?.();

      showMessage('הצלחה', 'בקשת הלקוח נמחקה לגמרי');
    } catch (error) {
      console.error('שגיאה במחיקת בקשת לקוח:', error);
      showMessage('שגיאה', 'לא ניתן למחוק את בקשת הלקוח');
    } finally {
      setSavingId(null);
    }
  };

  const extendClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    if (selectedClient.approvalStatus === 'pending') {
      showMessage('שגיאה', 'לא ניתן להאריך גישה ללקוח שעדיין ממתין לאישור');
      return;
    }

    if (!selectedClient.accessEndAt) {
      showMessage(
        'שגיאה',
        'ללקוח כבר מוגדרת גישה ללא הגבלה. אין צורך להאריך.'
      );
      return;
    }

    const days = getValidDays();
    if (!days) return;

    const currentEnd = new Date(selectedClient.accessEndAt).getTime();
    const base = Math.max(currentEnd, Date.now());
    const newEnd = new Date(base + days * 24 * 60 * 60 * 1000);

    try {
      setSavingId(selectedClient.id);

      await updateDoc(doc(db, 'users', selectedClient.id), {
        approvalStatus: 'approved',
        role: 'client',
        accessEndAt: newEnd.toISOString(),
      });

      await onAfterUpdate?.();

      showMessage(
        'הצלחה',
        `תקופת הגישה הוארכה עד ${formatDateTimeIL(newEnd.toISOString())}`
      );
    } catch (error) {
      console.error('שגיאה בהארכת גישה:', error);
      showMessage('שגיאה', 'לא ניתן להאריך את תקופת הגישה');
    } finally {
      setSavingId(null);
    }
  };

  const reduceClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    if (selectedClient.approvalStatus === 'pending') {
      showMessage('שגיאה', 'לא ניתן להפחית גישה ללקוח שעדיין ממתין לאישור');
      return;
    }

    if (!selectedClient.accessEndAt) {
      showMessage(
        'שגיאה',
        'ללקוח יש גישה ללא הגבלה. אי אפשר להפחית זמן עד שמוגדר תאריך סיום.'
      );
      return;
    }

    const days = getValidDays();
    if (!days) return;

    try {
      setSavingId(selectedClient.id);

      const currentEndMs = new Date(selectedClient.accessEndAt).getTime();
      const reducedEnd = new Date(
        currentEndMs - days * 24 * 60 * 60 * 1000
      );

      await updateDoc(doc(db, 'users', selectedClient.id), {
        approvalStatus: 'approved',
        role: 'client',
        accessEndAt: reducedEnd.toISOString(),
      });

      await onAfterUpdate?.();

      showMessage(
        'הצלחה',
        `תקופת הגישה קוצרה.\nתאריך הסיום החדש: ${formatDateTimeIL(
          reducedEnd.toISOString()
        )}`
      );
    } catch (error) {
      console.error('שגיאה בהפחתת גישה:', error);
      showMessage('שגיאה', 'לא ניתן להפחית את תקופת הגישה');
    } finally {
      setSavingId(null);
    }
  };

  const setUnlimitedForSelectedClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    if (selectedClient.approvalStatus === 'pending') {
      showMessage('שגיאה', 'לא ניתן להגדיר גישה לפני אישור הלקוח');
      return;
    }

    try {
      setSavingId(selectedClient.id);

      await updateDoc(doc(db, 'users', selectedClient.id), {
        approvalStatus: 'approved',
        role: 'client',
        accessEndAt: null,
      });

      await onAfterUpdate?.();

      showMessage('הצלחה', 'הוגדרה ללקוח גישה ללא הגבלה');
    } catch (error) {
      console.error('שגיאה בהגדרת גישה ללא הגבלה:', error);
      showMessage('שגיאה', 'לא ניתן להגדיר גישה ללא הגבלה');
    } finally {
      setSavingId(null);
    }
  };

  const blockOrUnblockClient = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    if (selectedClient.approvalStatus === 'pending') {
      showMessage('שגיאה', 'לא ניתן לחסום לקוח לפני אישור. ניתן למחוק את הבקשה מרשימת ההמתנה.');
      return;
    }

    const isBlocked = selectedClient.approvalStatus === 'blocked';

    try {
      setSavingId(selectedClient.id);

      if (isBlocked) {
        await updateDoc(doc(db, 'users', selectedClient.id), {
          approvalStatus: 'approved',
          role: 'client',
          accessStartAt: new Date().toISOString(),
          accessEndAt: null,
        });

        await onAfterUpdate?.();

        showMessage('הצלחה', 'החסימה בוטלה והלקוח חזר לגישה ללא הגבלה');
      } else {
        await updateDoc(doc(db, 'users', selectedClient.id), {
          approvalStatus: 'blocked',
          role: 'client',
          accessStartAt: null,
          accessEndAt: null,
        });

        await onAfterUpdate?.();

        showMessage('בוצע', 'הגישה של הלקוח נחסמה לצמיתות עד ביטול החסימה');
      }
    } catch (error) {
      console.error('שגיאה בעדכון חסימה:', error);
      showMessage('שגיאה', 'לא ניתן לעדכן את מצב החסימה של הלקוח');
    } finally {
      setSavingId(null);
    }
  };

  const runSelectedAction = async () => {
    if (!selectedClient) {
      showMessage('שגיאה', 'יש לבחור לקוח');
      return;
    }

    if (selectedClient.approvalStatus === 'pending') {
      showMessage('שגיאה', 'על לקוח שממתין לאישור ניתן לפעול דרך רשימת ההמתנה בלבד');
      return;
    }

    if (selectedAction === 'extend') {
      await extendClient();
      return;
    }

    if (selectedAction === 'reduce') {
      await reduceClient();
      return;
    }

    if (selectedAction === 'unlimited') {
      await setUnlimitedForSelectedClient();
      return;
    }

    await blockOrUnblockClient();
  };

  const selectedActionLabel = useMemo(() => {
    if (selectedAction === 'extend') return 'הארכת גישה';
    if (selectedAction === 'reduce') return 'הפחתת גישה';
    if (selectedAction === 'unlimited') return 'גישה ללא הגבלה';

    return selectedClient?.approvalStatus === 'blocked'
      ? 'ביטול חסימה'
      : 'חסימת גישה';
  }, [selectedAction, selectedClient]);

  const actionNeedsDays =
    selectedAction === 'extend' || selectedAction === 'reduce';

  const renderEndDate = (client: ClientItem) => {
    if (!isHydrated) return '...';
    if (client.approvalStatus === 'blocked') return 'חסום עד לביטול';
    if (client.approvalStatus === 'pending') return 'ממתין לאישור';
    return formatDateTimeIL(client.accessEndAt);
  };

  const renderRemainingTime = (client: ClientItem) => {
    if (!isHydrated) return '...';
    if (client.approvalStatus === 'blocked') return 'חסום';
    if (client.approvalStatus === 'pending') return 'ממתין לאישור';
    return getRemainingTimeLabel(client.accessEndAt);
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionTitle}>אישור לקוחות והגדרת תקופת גישה</Text>

      <View style={styles.pendingBox}>
        <Text style={styles.pendingTitle}>לקוחות שממתינים לאישור</Text>

        {loadingClients ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="small" color="#0F172A" />
            <Text style={styles.emptyText}>טוען לקוחות...</Text>
          </View>
        ) : pendingClients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>אין לקוחות שממתינות לאישור</Text>
          </View>
        ) : (
          pendingClients.map((client) => {
            const isSaving = savingId === client.id;

            return (
              <View key={`pending-${client.id}`} style={styles.pendingClientCard}>
                <View style={styles.pendingClientInfo}>
                  <Text style={styles.clientName}>{client.name || 'ללא שם'}</Text>
                  <Text style={styles.clientEmail}>
                    {client.email || 'ללא אימייל'}
                  </Text>
                  <Text style={styles.pendingStatusText}>סטטוס: ממתין לאישור</Text>
                </View>

                <View style={styles.pendingButtonsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.pendingDeleteButton,
                      pressed && styles.pressed,
                      isSaving && styles.disabled,
                    ]}
                    onPress={() => deletePendingClientById(client.id)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#B91C1C" />
                    ) : (
                      <Text style={styles.pendingDeleteButtonText}>מחק בקשה</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.approvePendingButton,
                      pressed && styles.pressed,
                      isSaving && styles.disabled,
                    ]}
                    onPress={() => approveClientById(client.id)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.approvePendingButtonText}>אשר לקוח</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.clientsList}>
        {loadingClients ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator size="small" color="#0F172A" />
            <Text style={styles.emptyText}>טוען לקוחות...</Text>
          </View>
        ) : clients.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>אין לקוחות להצגה</Text>
          </View>
        ) : (
          clients.map((client) => {
            const isSelected = selectedClientId === client.id;

            return (
              <Pressable
                key={client.id}
                onPress={() => setSelectedClientId(client.id)}
                style={({ pressed }) => [
                  styles.clientItem,
                  isSelected && styles.clientItemSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.clientName}>{client.name || 'ללא שם'}</Text>
                <Text style={styles.clientEmail}>
                  {client.email || 'ללא אימייל'}
                </Text>

                <Text style={styles.clientMeta}>
                  סטטוס:{' '}
                  {client.approvalStatus === 'approved'
                    ? 'מאושר'
                    : client.approvalStatus === 'blocked'
                    ? 'חסום'
                    : 'ממתין לאישור'}
                </Text>

                <Text style={styles.clientMeta}>
                  תאריך סיום: {renderEndDate(client)}
                </Text>

                <Text style={styles.clientMeta}>
                  זמן שנותר: {renderRemainingTime(client)}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <View style={styles.actionsBox}>
        <Text style={styles.actionsTitle}>פעולות על לקוח נבחר</Text>

        <View style={styles.selectedClientBox}>
          {selectedClient ? (
            <>
              <Text style={styles.selectedClientName}>
                {selectedClient.name || 'ללא שם'}
              </Text>
              <Text style={styles.selectedClientMeta}>
                {selectedClient.email || 'ללא אימייל'}
              </Text>
              {selectedClient.approvalStatus === 'pending' && (
                <Text style={styles.pendingHintText}>
                  לקוח זה עדיין ממתין לאישור. ניתן לאשר או למחוק את הבקשה מרשימת ההמתנה למעלה.
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.selectedClientPlaceholder}>
              בחרי לקוח מהרשימה
            </Text>
          )}
        </View>

        <View style={styles.pickerLabelRow}>
          <Text style={styles.pickerLabel}>בחרי פעולה</Text>
        </View>

        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={selectedAction}
            onValueChange={(value) =>
              setSelectedAction(value as SelectedAction)
            }
            enabled={!savingId && selectedClient?.approvalStatus !== 'pending'}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="הארכת גישה" value="extend" />
            <Picker.Item label="הפחתת גישה" value="reduce" />
            <Picker.Item label="גישה ללא הגבלה" value="unlimited" />
            <Picker.Item
              label={
                selectedClient?.approvalStatus === 'blocked'
                  ? 'ביטול חסימה'
                  : 'חסימת גישה'
              }
              value="toggleBlock"
            />
          </Picker>
        </View>

        {actionNeedsDays && selectedClient?.approvalStatus !== 'pending' && (
          <View style={styles.controlBox}>
            <Text style={styles.label}>מספר ימים</Text>
            <TextInput
              value={daysInput}
              onChangeText={setDaysInput}
              keyboardType="number-pad"
              placeholder="למשל 30"
              placeholderTextColor="#94A3B8"
              style={styles.input}
              textAlign="right"
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.mainActionButton,
            pressed && styles.pressed,
            (!selectedClient ||
              !!savingId ||
              selectedClient.approvalStatus === 'pending') &&
              styles.disabled,
          ]}
          onPress={runSelectedAction}
          disabled={
            !selectedClient ||
            !!savingId ||
            selectedClient.approvalStatus === 'pending'
          }
        >
          {savingId === selectedClient?.id ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.mainActionButtonText}>{selectedActionLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    gap: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  pendingBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },

  pendingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  pendingClientCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },

  pendingClientInfo: {
    alignItems: 'flex-end',
  },

  pendingStatusText: {
    marginTop: 6,
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
    textAlign: 'right',
  },

  pendingButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },

  approvePendingButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  approvePendingButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  pendingDeleteButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  pendingDeleteButtonText: {
    color: '#B91C1C',
    fontWeight: '800',
    fontSize: 15,
  },

  clientsList: {
    gap: 10,
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },

  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  clientItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },

  clientItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },

  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  clientEmail: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },

  clientMeta: {
    marginTop: 6,
    fontSize: 13,
    color: '#334155',
    textAlign: 'right',
  },

  actionsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },

  actionsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'right',
  },

  selectedClientBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    alignItems: 'flex-end',
  },

  selectedClientName: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '800',
    textAlign: 'right',
  },

  selectedClientMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'right',
  },

  pendingHintText: {
    marginTop: 8,
    fontSize: 13,
    color: '#B45309',
    fontWeight: '700',
    textAlign: 'right',
  },

  selectedClientPlaceholder: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },

  pickerLabelRow: {
    alignItems: 'flex-end',
  },

  pickerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
  },

  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },

  picker: {
    width: '100%',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    fontSize: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  pickerItem: {
    fontSize: 18,
    textAlign: 'right',
  },

  controlBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 8,
  },

  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlign: 'right',
  },

  mainActionButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  mainActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.6,
  },
});