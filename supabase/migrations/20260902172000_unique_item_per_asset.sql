-- Ta sama podatnosc nie moze stac dwa razy na tym samym zasobie.
--
-- Regula istniala juz w produkcie, ale wylacznie w warstwie aplikacji i tylko na
-- jednej z dwoch sciezek wejscia: wczytywanie z zewnetrznego zrodla odrzucalo
-- duplikaty zbiorem zbudowanym z istniejacych wierszy, a reczne dopisanie nie
-- sprawdzalo niczego. Schemat o regule nie wiedzial w ogole.
--
-- Tutaj staje sie wlasnoscia struktury. Dzieki temu obowiazuje takze przy zapisie
-- z pominieciem aplikacji i zamyka wyscig dwoch rownoleglych wczytan tego samego
-- raportu, ktorego sprawdzenie w kodzie zamknac nie moze - oba czytaja stan sprzed
-- zapisu drugiego.
--
-- Bez filtrowania po statusie, swiadomie. Podatnosc raz rozstrzygnieta wraca do
-- kolejki przez przywrocenie (FR-016), ktore dopisuje wpis do istniejacej historii.
-- Dodanie jej jako nowej pozycji rozbiloby historie tej samej podatnosci na tym
-- samym zasobie na dwa niezalezne slady, a FR-015 obiecuje cos przeciwnego: powrot
-- do zamknietej pozycji wraz z jej uzasadnieniem.
--
-- upper(identifier), bo sciezka wczytywania normalizuje identyfikator do wielkich
-- liter, a formularz nie. Bez tego "cve-2026-1111" i "CVE-2026-1111" bylyby dla bazy
-- dwiema podatnosciami, a dla czlowieka jedna.
--
-- Migracja nie kasuje istniejacych duplikatow. Jesli jakies sa, utworzenie indeksu
-- zawiedzie i przebieg bedzie czerwony. To jest zachowanie zamierzone: usuniecie
-- cudzych wierszy w migracji byloby decyzja, ktorej nikt swiadomie nie podjal, a
-- cicha naprawa danych to dokladnie ta klasa zachowania, przed ktora ten projekt
-- sie broni.

create unique index vulnerabilities_unique_identifier_per_asset
  on public.vulnerabilities (asset_id, upper(identifier));

comment on index public.vulnerabilities_unique_identifier_per_asset is
  'Ta sama podatnosc nie moze stac dwa razy na tym samym zasobie, niezaleznie od statusu pozycji. Powrot rozstrzygnietej pozycji do kolejki nastepuje przez przywrocenie, nie przez nowy wpis.';
