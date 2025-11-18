import { FC, useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LM_Text, LM_TextInput } from '../../components';
import { LM } from '../../constants';

const Advert_List: FC = () => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');

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

  return (
    <SafeAreaView
      edges={['left', 'top', 'right']}
      style={[
        LM.flex,
        { backgroundColor: LM.background_neutral },
      ]}>
      <View style={[LM.padding_rg]}>
        <LM_TextInput
          type="search"
          onChangeText={handleSearch}
          value={searchText}
          placeholder="Suche nach Anzeigen..."
        />

        {debouncedSearchText && (
          <View
            style={[
              LM.padding_rg,
              LM.margin_t_rg,
              {
                backgroundColor: LM.background_white,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e0e0e0',
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
      </View>
    </SafeAreaView>
  );
};

export default Advert_List;
