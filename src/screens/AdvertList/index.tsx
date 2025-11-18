import { triggerHapticFeedback } from '@common';
import {
  Category,
  fetchCategories as fetchCategoriesApi,
} from '@core/api';
import { useApiTranslation } from '@l10n';
import { useFocusEffect } from '@react-navigation/native';
import { Effect } from 'effect';
import { FC, useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LM_Text, LM_TextInput } from '../../components';
import { LM } from '../../constants';
import {
  getAdvertCategoryColor,
  getAdvertCategoryIconBig,
} from '../../functions';

const Advert_List: FC = ({ route, navigation }) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [categories, setCategories] = useState<readonly Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(
    route?.params?.category || 0,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getT } = useApiTranslation();

  // Debouncing logic for search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [searchText]);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
  }, []);

  const fetchCategories = async () => {
    await Effect.runPromise(
      Effect.match(
        fetchCategoriesApi({
          filter: {
            parentId: undefined,
          },
        }),
        {
          onFailure: (error) => {
            setError(error.message || 'An error occurred');
            console.error('Failed to load categories:', error);
          },
          onSuccess: (categoriesResponse) => {
            setCategories([
              {
                code: '',
                parentId: null,
                id: 0,
                translations: [
                  {
                    languagesCode: { code: 'de' },
                    title: 'Entdecken',
                    slug: '',
                  },
                ],
              },
              ...categoriesResponse,
            ]);
            setLoading(false);
          },
        },
      ),
    );
  };

  const handleCategoryChange = useCallback((newCategoryId: number) => {
    setSelectedCategory(newCategoryId);
    triggerHapticFeedback();
    // Category filtering logic will go here
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!route.params || Object.keys(route.params).length === 0) {
        fetchCategories();
      }
      if (route?.params?.category) {
        handleCategoryChange(route.params.category);
        delete route.params.category;
      }
    }, [route, handleCategoryChange]),
  );

  const renderCategoryItem = ({ item }: { item: Category }) => {
    return (
      <Pressable
        onPress={() => {
          handleCategoryChange(item.id);
        }}
        unstable_pressDelay={75}>
        {({ pressed }) => (
          <View style={[LM.items_center, LM.gap_sm, LM.width_x4l]}>
            {pressed
              ? getAdvertCategoryIconBig(item.image?.id, 'active')
              : selectedCategory === item.id
                ? getAdvertCategoryIconBig(item.image?.id, 'active')
                : getAdvertCategoryIconBig(item.image?.id, 'disabled')}
            <LM_Text
              type={'tiny'}
              style={[
                LM.items_center,
                {
                  color: pressed
                    ? getAdvertCategoryColor('', 'pressed')
                    : selectedCategory === item.id
                      ? getAdvertCategoryColor('', 'active')
                      : LM.text_light,
                },
              ]}
              numberOfLines={1}>
              {getT(item.translations ?? [])?.title}
            </LM_Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      edges={['left', 'top', 'right']}
      style={[
        LM.flex,
        { backgroundColor: LM.background_neutral },
      ]}>
      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.navButton}>
          <LM_Text type="body" style={styles.navButtonText}>
            ← Zurück
          </LM_Text>
        </TouchableOpacity>
        <LM_Text type="h3" style={styles.navTitle}>
          Marktplatz
        </LM_Text>
        <View style={styles.navButton} />
      </View>

      <ScrollView>
        <View style={[LM.padding_rg]}>
          <LM_TextInput
            type="search"
            onChangeText={handleSearch}
            value={searchText}
            placeholder="Suche nach Anzeigen..."
          />

          {!loading && categories.length > 0 && (
            <View style={[LM.margin_t_rg]}>
              <LM_Text type="small" style={{ color: LM.text_light, marginBottom: 8 }}>
                Kategorien:
              </LM_Text>
              <FlatList
                horizontal={true}
                data={categories}
                keyExtractor={(categoryItem) => categoryItem.id.toString()}
                renderItem={renderCategoryItem}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[LM.gap_rg]}
              />
            </View>
          )}

          {selectedCategory !== 0 && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: LM.background_white,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#4CAF50',
                },
              ]}>
              <LM_Text type="small" style={{ color: LM.text_light }}>
                Ausgewählte Kategorie:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4 }}>
                {getT(
                  categories.find((cat) => cat.id === selectedCategory)
                    ?.translations ?? [],
                )?.title || 'Unbekannt'}
              </LM_Text>
            </View>
          )}

          {debouncedSearchText && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: LM.background_white,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#2196F3',
                },
              ]}>
              <LM_Text type="small" style={{ color: LM.text_light }}>
                Suche nach:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4 }}>
                {debouncedSearchText}
              </LM_Text>
            </View>
          )}

          {loading && (
            <View style={[LM.padding_rg, LM.margin_t_rg]}>
              <LM_Text type="body" style={{ color: LM.text_light }}>
                Kategorien werden geladen...
              </LM_Text>
            </View>
          )}

          {error && (
            <View
              style={[
                LM.padding_rg,
                LM.margin_t_rg,
                {
                  backgroundColor: '#ffebee',
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#f44336',
                },
              ]}>
              <LM_Text type="small" style={{ color: '#c62828' }}>
                Fehler:
              </LM_Text>
              <LM_Text type="body" style={{ marginTop: 4, color: '#c62828' }}>
                {error}
              </LM_Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  navButton: {
    width: 80,
    paddingVertical: 8,
  },
  navButtonText: {
    color: '#2196F3',
    fontWeight: '500',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
});

export default Advert_List;
