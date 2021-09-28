import React, { useState } from "react";
import { t } from "ttag";

import _ from "underscore";

import { CardApi } from "metabase/services";

import * as Queries from "../../audit_app/lib/cards/queries";
import AuditTable from "../../audit_app/containers/AuditTable";
import AuditParameters from "../../audit_app/components/AuditParameters";
import { ErrorMode } from "../mode";

const getSortOrder = isAscending => (isAscending ? "asc" : "desc");

const CARD_ID_COL = 0;

export default function ErrorOverview(props) {
  const [hasResults, setHasResults] = useState(false);
  const [sorting, setSorting] = useState({
    column: "last_run_at",
    isAscending: false,
  });

  const [rowChecked, setRowChecked] = useState({});
  const [rowToCardId, setRowToCardId] = useState({});
  const handleRowSelectClick = e => {
    const newRowChecked = rowChecked;
    const newRowToCardId = rowToCardId;
    newRowChecked[e.rowIndex] = !(rowChecked[e.rowIndex] || false);
    newRowToCardId[e.rowIndex] = e.row[CARD_ID_COL];
    setRowChecked(newRowChecked);
    setRowToCardId(newRowToCardId);
  };

  const handleReloadSelected = async () => {
    const checkedCardIds = Object.values(
      _.pick(rowToCardId, (member, key) => rowChecked[key]),
    );
    await Promise.all(
      checkedCardIds.map(
        async member => await CardApi.query({ cardId: member }),
      ),
    );
    location.reload();
  };

  const handleSortingChange = sorting => setSorting(sorting);
  return (
    <AuditParameters
      parameters={[
        { key: "errorFilter", placeholder: t`Error name` },
        { key: "dbFilter", placeholder: t`DB name` },
        { key: "collectionFilter", placeholder: t`Collection name` },
      ]}
      buttons={[
        {
          key: "reloadSelected",
          label: t`Rerun Selected`,
          onClick: handleReloadSelected,
        },
      ]}
      hasResults={hasResults}
    >
      {({ errorFilter, dbFilter, collectionFilter }) => (
        <AuditTable
          {...props}
          pageSize={50}
          isSortable
          isSelectable
          selectHeader={t`Rerun?`}
          rowChecked={rowChecked}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          onRowSelectClick={handleRowSelectClick}
          onLoad={res => {
            setHasResults(res[0].row_count !== 0);
          }}
          mode={ErrorMode}
          table={Queries.bad_table(
            errorFilter,
            dbFilter,
            collectionFilter,
            sorting.column,
            getSortOrder(sorting.isAscending),
          )}
        />
      )}
    </AuditParameters>
  );
}
