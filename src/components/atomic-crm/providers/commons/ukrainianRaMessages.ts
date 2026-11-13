import type { TranslationMessages } from "ra-core";

/**
 * Ukrainian messages of ra-core and ra-supabase. The community package
 * ra-language-ukrainian targets react-admin 4 (it depends on ra-core 4), so
 * the catalog lives here. Plurals use the three Ukrainian forms
 * (1 елемент |||| 2 елементи |||| 5 елементів).
 */
export const ukrainianRaMessages: TranslationMessages = {
  ra: {
    action: {
      add_filter: "Додати фільтр",
      add: "Додати",
      back: "Назад",
      bulk_actions:
        "Вибрано %{smart_count} елемент |||| Вибрано %{smart_count} елементи |||| Вибрано %{smart_count} елементів",
      cancel: "Скасувати",
      clear_array_input: "Очистити список",
      clear_input_value: "Очистити",
      clone: "Копіювати",
      confirm: "Підтвердити",
      create: "Створити",
      create_item: "Створити %{item}",
      delete: "Видалити",
      edit: "Редагувати",
      export: "Експорт",
      list: "Список",
      refresh: "Оновити",
      remove_filter: "Прибрати фільтр",
      remove_all_filters: "Прибрати всі фільтри",
      remove: "Прибрати",
      reset: "Скинути",
      save: "Зберегти",
      search: "Пошук",
      search_columns: "Пошук стовпців",
      select_all: "Вибрати все",
      select_all_button: "Вибрати все",
      select_row: "Вибрати рядок",
      show: "Переглянути",
      sort: "Сортувати",
      undo: "Скасувати",
      unselect: "Зняти вибір",
      expand: "Розгорнути",
      close: "Закрити",
      open_menu: "Відкрити меню",
      close_menu: "Закрити меню",
      update: "Оновити",
      move_up: "Вгору",
      move_down: "Вниз",
      open: "Відкрити",
      toggle_theme: "Світла / темна тема",
      select_columns: "Стовпці",
      update_application: "Перезавантажити застосунок",
    },
    boolean: {
      true: "Так",
      false: "Ні",
      null: " ",
    },
    page: {
      create: "Створити: %{name}",
      dashboard: "Головна",
      edit: "%{name} %{recordRepresentation}",
      error: "Щось пішло не так",
      list: "%{name}",
      loading: "Завантаження",
      not_found: "Сторінку не знайдено",
      show: "%{name} %{recordRepresentation}",
      empty: "Тут ще немає записів: %{name}.",
      invite: "Додати перший?",
      access_denied: "Немає доступу",
      authentication_error: "Помилка входу",
    },
    input: {
      file: {
        upload_several: "Перетягніть файли сюди або натисніть, щоб вибрати.",
        upload_single: "Перетягніть файл сюди або натисніть, щоб вибрати.",
      },
      image: {
        upload_several:
          "Перетягніть зображення сюди або натисніть, щоб вибрати.",
        upload_single:
          "Перетягніть зображення сюди або натисніть, щоб вибрати.",
      },
      references: {
        all_missing: "Не вдалося знайти повʼязані дані.",
        many_missing: "Деякі повʼязані записи більше не доступні.",
        single_missing: "Повʼязаний запис більше не доступний.",
      },
      password: {
        toggle_visible: "Сховати пароль",
        toggle_hidden: "Показати пароль",
      },
    },
    message: {
      about: "Про програму",
      access_denied: "У вас немає прав для цієї сторінки",
      are_you_sure: "Ви впевнені?",
      authentication_error:
        "Сервер входу повернув помилку, тому дані не вдалося перевірити.",
      auth_error: "Не вдалося перевірити токен входу.",
      bulk_delete_content:
        "Видалити %{name}? |||| Видалити ці %{smart_count} елементи? |||| Видалити ці %{smart_count} елементів?",
      bulk_delete_title:
        "Видалити %{name} |||| Видалити %{smart_count} елементи |||| Видалити %{smart_count} елементів",
      bulk_update_content:
        "Оновити %{name} %{recordRepresentation}? |||| Оновити ці %{smart_count} елементи? |||| Оновити ці %{smart_count} елементів?",
      bulk_update_title:
        "Оновити %{name} %{recordRepresentation} |||| Оновити %{smart_count} елементи |||| Оновити %{smart_count} елементів",
      clear_array_input: "Очистити весь список?",
      delete_content: "Видалити цей запис?",
      delete_title: "Видалити %{name} %{recordRepresentation}",
      details: "Подробиці",
      error: "Сталася помилка, запит не виконано.",
      invalid_form: "У формі є помилки. Перевірте поля.",
      loading: "Зачекайте",
      no: "Ні",
      not_found: "Адресу введено з помилкою або посилання застаріло.",
      select_all_limit_reached:
        "Елементів забагато, тому вибрано лише перші %{max}.",
      unsaved_changes: "Деякі зміни не збережено. Все одно вийти?",
      yes: "Так",
      placeholder_data_warning: "Проблема з мережею: дані не оновилися.",
    },
    navigation: {
      clear_filters: "Скинути фільтри",
      no_filtered_results: "Нічого не знайдено з цими фільтрами.",
      no_results: "Нічого не знайдено",
      no_more_results: "Сторінки %{page} немає. Спробуйте попередню.",
      page_out_of_boundaries: "Сторінки %{page} немає",
      page_out_from_end: "Це остання сторінка",
      page_out_from_begin: "Це перша сторінка",
      page_range_info: "%{offsetBegin}–%{offsetEnd} з %{total}",
      partial_page_range_info:
        "%{offsetBegin}–%{offsetEnd} з понад %{offsetEnd}",
      current_page: "Сторінка %{page}",
      page: "Перейти на сторінку %{page}",
      first: "На першу сторінку",
      last: "На останню сторінку",
      next: "Наступна сторінка",
      previous: "Попередня сторінка",
      page_rows_per_page: "Рядків на сторінці:",
      skip_nav: "Перейти до змісту",
    },
    sort: {
      sort_by: "Сортування: %{field_lower_first}, %{order}",
      ASC: "за зростанням",
      DESC: "за спаданням",
    },
    auth: {
      auth_check_error: "Увійдіть, щоб продовжити",
      user_menu: "Профіль",
      username: "Імʼя користувача",
      password: "Пароль",
      email: "Ел. пошта",
      sign_in: "Увійти",
      sign_in_error: "Не вдалося увійти, спробуйте ще раз",
      logout: "Вийти",
    },
    notification: {
      updated:
        "Збережено |||| Збережено %{smart_count} елементи |||| Збережено %{smart_count} елементів",
      created: "Створено",
      deleted:
        "Видалено |||| Видалено %{smart_count} елементи |||| Видалено %{smart_count} елементів",
      bad_item: "Неправильний елемент",
      item_doesnt_exist: "Елемент не існує",
      http_error: "Помилка звʼязку із сервером",
      data_provider_error: "Помилка даних. Подробиці в консолі.",
      i18n_error: "Не вдалося завантажити переклад",
      canceled: "Дію скасовано",
      logged_out: "Сесія завершилась, увійдіть знову.",
      not_authorized: "У вас немає доступу до цього розділу.",
      application_update_available: "Доступна нова версія.",
      offline: "Немає інтернету. Дані не завантажено.",
    },
    validation: {
      required: "Обовʼязкове поле",
      minLength: "Щонайменше %{min} символів",
      maxLength: "Не більше %{max} символів",
      minValue: "Не менше %{min}",
      maxValue: "Не більше %{max}",
      number: "Має бути число",
      email: "Має бути адреса ел. пошти",
      oneOf: "Має бути одне з: %{options}",
      regex: "Має відповідати формату: %{pattern}",
      unique: "Має бути унікальним",
    },
    saved_queries: {
      label: "Збережені запити",
      query_name: "Назва запиту",
      new_label: "Зберегти поточний запит…",
      new_dialog_title: "Зберегти поточний запит як",
      remove_label: "Видалити збережений запит",
      remove_label_with_name: "Видалити запит «%{name}»",
      remove_dialog_title: "Видалити збережений запит?",
      remove_message: "Видалити цей запит зі збережених?",
      help: "Відфільтруйте список і збережіть запит на потім",
    },
    guesser: {
      empty: {
        title: "Немає даних",
        message: "Перевірте джерело даних",
      },
    },
    configurable: {
      customize: "Налаштувати",
      configureMode: "Налаштувати сторінку",
      inspector: {
        title: "Інспектор",
        content: "Наведіть на елементи інтерфейсу, щоб налаштувати їх",
        reset: "Скинути налаштування",
        hideAll: "Сховати все",
        showAll: "Показати все",
      },
      Datagrid: {
        title: "Таблиця",
        unlabeled: "Стовпець без назви №%{column}",
      },
      SimpleForm: {
        title: "Форма",
        unlabeled: "Поле без назви №%{input}",
      },
      SimpleList: {
        title: "Список",
        primaryText: "Основний текст",
        secondaryText: "Додатковий текст",
        tertiaryText: "Третій рядок",
      },
    },
  },
  "ra-supabase": {
    auth: {
      email: "Ел. пошта",
      confirm_password: "Повторіть пароль",
      sign_in_with: "Увійти через %{provider}",
      forgot_password: "Забули пароль?",
      reset_password: "Скинути пароль",
      password_reset: "Перевірте пошту: там лист для зміни пароля.",
      missing_tokens: "Бракує токенів доступу",
      back_to_login: "Повернутися до входу",
    },
    reset_password: {
      forgot_password: "Забули пароль?",
      forgot_password_details: "Введіть ел. пошту, і ми надішлемо інструкції.",
    },
    set_password: {
      new_password: "Придумайте пароль",
    },
    validation: {
      password_mismatch: "Паролі не збігаються",
    },
    oauth: {
      authorize: "Дозволити доступ",
      authorize_details: "Цей застосунок просить доступ до вашого акаунта.",
      access_scope:
        "Він зможе читати й змінювати ваші дані з тими самими правами, що й ваш акаунт.",
      approved: "Доступ дозволено",
      close_tab: "Цю вкладку можна закрити.",
      no_request: "Запит на доступ не знайдено",
    },
  },
};
