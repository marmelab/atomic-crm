import {
  ListIterator,
  type RaRecord,
  sanitizeListRestProps,
  useGetRecordRepresentation,
  useListContextWithProps,
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { isValidElement, type ReactElement } from "react";

import { ListNoResults } from "./ListNoResults.tsx";
import type { FunctionToElement } from "./SimpleListItem.tsx";
import {
  type SimpleListBaseProps,
  SimpleListItem,
  type SimpleListItemProps,
} from "./SimpleListItem.tsx";
import { SimpleListLoading } from "./SimpleListLoading.tsx";

/**
 * The <SimpleList> component renders a list of records
 * It is usually used as a child of shadcn-admin-kit's <List> and <ReferenceManyField> components.
 *
 * Also widely used on Mobile.
 *
 * Props:
 * - primaryText: function returning a React element (or some text) based on the record
 * - secondaryText: same
 * - tertiaryText: same
 * - leftAvatar: function returning a React element based on the record
 * - leftIcon: same
 * - rightAvatar: same
 * - rightIcon: same
 * - linkType: deprecated - 'edit' or 'show', or a function returning 'edit' or 'show' based on the record
 * - rowClick: The action to trigger when the user clicks on a row.
 * - rowStyle: function returning a style object based on (record, index)
 * - rowSx: function returning a sx object based on (record, index)
 *
 * @example // Display all posts as a List
 * const postRowSx = (record, index) => ({
 *     backgroundColor: record.views >= 500 ? '#efe' : 'white',
 * });
 * export const PostList = () => (
 *     <List>
 *         <SimpleList
 *             primaryText={record => record.title}
 *             secondaryText={record => `${record.views} views`}
 *             tertiaryText={record =>
 *                 new Date(record.published_at).toLocaleDateString()
 *             }
 *             rowSx={postRowSx}
 *          />
 *     </List>
 * );
 */
export const SimpleList = <RecordType extends RaRecord = any>(
  props: SimpleListProps<RecordType>,
) => {
  const {
    className,
    empty = DefaultEmpty,
    leftAvatar,
    leftIcon,
    linkType,
    rowClick,
    primaryText,
    rightAvatar,
    rightIcon,
    secondaryText,
    tertiaryText,
    resource,
    ...rest
  } = props;
  const { data, isPending, total } = useListContextWithProps<RecordType>(props);

  if (isPending === true) {
    return (
      <SimpleListLoading
        className={className}
        hasLeftAvatarOrIcon={!!leftIcon || !!leftAvatar}
        hasRightAvatarOrIcon={!!rightIcon || !!rightAvatar}
        hasSecondaryText={!!secondaryText}
        hasTertiaryText={!!tertiaryText}
      />
    );
  }

  if (data == null || data.length === 0 || total === 0) {
    if (empty) {
      return empty;
    }

    return null;
  }

  return (
    <ul className={className} {...sanitizeListRestProps(rest)}>
      <ListIterator<RecordType>
        data={data}
        total={total}
        render={(record, rowIndex) => (
          <SimpleListItem
            key={record.id}
            rowIndex={rowIndex}
            linkType={linkType}
            rowClick={rowClick}
            resource={resource}
          >
            <SimpleListItemContent
              leftAvatar={leftAvatar}
              leftIcon={leftIcon}
              primaryText={primaryText}
              rightAvatar={rightAvatar}
              rightIcon={rightIcon}
              secondaryText={secondaryText}
              tertiaryText={tertiaryText}
              rowIndex={rowIndex}
            />
          </SimpleListItem>
        )}
      />
    </ul>
  );
};

export interface SimpleListProps<RecordType extends RaRecord = any>
  extends SimpleListBaseProps<RecordType> {
  className?: string;
  empty?: ReactElement;
  // can be injected when using the component without context
  resource?: string;
  data?: RecordType[];
  isLoading?: boolean;
  isPending?: boolean;
  isLoaded?: boolean;
  total?: number;
}

const SimpleListItemContent = <RecordType extends RaRecord = any>(
  props: SimpleListItemProps<RecordType>,
) => {
  const {
    leftAvatar,
    leftIcon,
    primaryText,
    rightAvatar,
    rightIcon,
    secondaryText,
    tertiaryText,
  } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext<RecordType>(props);
  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const translate = useTranslate();

  const renderAvatar = (
    record: RecordType,
    avatarCallback: FunctionToElement<RecordType>,
  ) => {
    const avatarValue = avatarCallback(record, record.id);
    if (
      typeof avatarValue === "string" &&
      (avatarValue.startsWith("http") || avatarValue.startsWith("data:"))
    ) {
      return (
        <img
          src={avatarValue}
          alt=""
          className="w-10 h-10 rounded-full object-cover"
        />
      );
    } else {
      return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm">
          {avatarValue}
        </div>
      );
    }
  };

  if (!record) return null;

  return (
    <div className="flex items-center space-x-3 p-3">
      {leftIcon && (
        <div className="flex-shrink-0">{leftIcon(record, record.id)}</div>
      )}
      {leftAvatar && (
        <div className="flex-shrink-0">{renderAvatar(record, leftAvatar)}</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium truncate">
            {primaryText
              ? typeof primaryText === "string"
                ? translate(primaryText, {
                    ...record,
                    _: primaryText,
                  })
                : isValidElement(primaryText)
                  ? primaryText
                  : primaryText(record, record.id)
              : getRecordRepresentation(record)}
          </div>

          {!!tertiaryText && (
            <div className="text-xs text-muted-foreground ml-2">
              {typeof tertiaryText === "string"
                ? translate(tertiaryText, {
                    ...record,
                    _: tertiaryText,
                  })
                : isValidElement(tertiaryText)
                  ? tertiaryText
                  : tertiaryText(record, record.id)}
            </div>
          )}
        </div>

        {!!secondaryText && (
          <div className="text-sm text-muted-foreground truncate">
            {typeof secondaryText === "string"
              ? translate(secondaryText, {
                  ...record,
                  _: secondaryText,
                })
              : isValidElement(secondaryText)
                ? secondaryText
                : secondaryText(record, record.id)}
          </div>
        )}
      </div>
      {(rightAvatar || rightIcon) && (
        <div className="flex-shrink-0 flex items-center space-x-2">
          {rightAvatar && renderAvatar(record, rightAvatar)}
          {rightIcon && rightIcon(record, record.id)}
        </div>
      )}
    </div>
  );
};

const DefaultEmpty = <ListNoResults />;
