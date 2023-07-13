// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { t, ngettext, msgid } from "ttag";
import _ from "underscore";
import moment from "moment-timezone";
import type {
  Filter as FilterObject,
  FieldFilter,
  FieldReference,
} from "metabase-types/api";
import {
  formatDateTimeRangeWithUnit,
  normalizeDateTimeRangeWithUnit,
} from "metabase/lib/formatting/date";
import { parseTimestamp } from "metabase/lib/time";
import { isExpression } from "metabase-lib/expressions";
import { getFilterArgumentFormatOptions } from "metabase-lib/operators/utils";
import {
  DATE_FORMAT,
  DATE_TIME_FORMAT,
  generateTimeFilterValuesDescriptions,
  getRelativeDatetimeField,
  isStartingFrom,
} from "metabase-lib/queries/utils/query-time";
import {
  isStandard,
  isSegment,
  isCustom,
  isFieldFilter,
  hasFilterOptions,
  getFilterOptions,
  setFilterOptions,
} from "metabase-lib/queries/utils/filter";
import type { FilterOperator } from "../../deprecated-types";
import Dimension from "../../Dimension";
import StructuredQuery from "../StructuredQuery";
import MBQLClause from "./MBQLClause";

interface FilterDisplayNameOpts {
  includeDimension?: boolean;
  includeOperator?: boolean;
}

// eslint-disable-next-line import/no-default-export -- deprecated usage
export default class Filter extends MBQLClause {
  /**
   * Replaces the filter in the parent query and returns the new StructuredQuery
   * or replaces itself in the parent query if no {filter} argument is provided.
   */
  replace(filter?: Filter | FilterObject): StructuredQuery {
    if (filter != null) {
      return this._query.updateFilter(this._index, filter);
    } else {
      return this._query.updateFilter(this._index, this);
    }
  }

  /**
   * Adds itself to the parent query and returns the new StructuredQuery
   */
  add(): StructuredQuery {
    return this._query.filter(this);
  }

  /**
   * Removes the filter in the parent query and returns the new StructuredQuery
   */
  remove(): StructuredQuery {
    return this._query.removeFilter(this._index);
  }

  /**
   * Returns an array of arguments if they are all dates.
   */
  dateArgs() {
    const args = this.arguments();
    if (args.every(arg => typeof arg === "string" && moment(arg).isValid())) {
      return args;
    }
  }

  /**
   * Returns a better formatted date label that accounts for ranges of different units.
   */
  betterDateLabel() {
    const args = this.dateArgs();
    if (!args) {
      return undefined;
    }

    const unit = this.dimension()?.temporalUnit() ?? "day";
    const isSupportedDateRangeUnit = [
      "day",
      "week",
      "month",
      "quarter",
      "year",
    ].includes(unit);
    const op = this.operatorName();
    const betweenDates = op === "between" && isSupportedDateRangeUnit;
    const equalsWeek = op === "=" && unit === "week";
    if (betweenDates || equalsWeek) {
      return formatDateTimeRangeWithUnit(args, unit, {
        type: "tooltip",
        date_resolution: unit === "week" ? "day" : unit,
      });
    }
    const sliceFormat = {
      // modified from DEFAULT_DATE_FORMATS in date.tsx to show extra context
      //
      // TODO: add friendlier labels for:
      //   minute-of-hour: like “nth minute of the hour” or “minute :32”
      //   hour-of-day:    like “nth hour of the day”    or “11:00–11:59PM” or “11:00–59 PM”
      //   (we can use moment.localeData().ordinal(n) to get an ordinalized number, e.g. 16th or 23rd)
      "minute-of-hour": "[minute] m",
      "hour-of-day": "[hour] H",
      "day-of-month": "Do [day of the month]",
      "day-of-year": "DDDo [day of the year]",
      "week-of-year": "wo [week of the year]",
    }[unit];
    const m = moment(args[0]);
    if (op === "=" && sliceFormat && m.isValid()) {
      return m.format(sliceFormat);
    }
  }

  /**
   * Tries to return a DatePicker-compatible version of this filter, otherwise returns itself,
   * because DatePicker cannot currently handle coarse units, so we convert them to day units instead.
   */
  toDatePickerFilter() {
    const args = this.dateArgs();
    if (!args) {
      return this;
    }

    const op = this.operatorName();
    const dim = this.dimension();
    const unit = dim?.temporalUnit() ?? "day";
    const TIME_UNITS = ["minute", "hour"];
    const COARSE_UNITS = ["week", "month", "quarter", "year"];

    // NOTE: All date args have to match the format constants found in query-time.js,
    //       DATE_FORMAT or DATE_TIME_FORMAT, otherwise SpecificDatePicker will not display it.
    if (unit === "day") {
      return this.set([
        op,
        dim?.withTemporalUnit(unit).mbql(),
        ...args.map(d => parseTimestamp(d, unit).format(DATE_FORMAT)),
      ]);
    } else if (TIME_UNITS.includes(unit)) {
      return this.set([
        op,
        dim.mbql(),
        ...args.map(d => parseTimestamp(d, unit).format(DATE_TIME_FORMAT)),
      ]);
    } else if (COARSE_UNITS.includes(unit)) {
      const dayOp = op === "=" ? "between" : op; // e.g. equal-week/month/quarter/year is always between-days
      const dayDim = dim?.withTemporalUnit("day");
      const [start, end] = normalizeDateTimeRangeWithUnit(args, unit);
      const dayArgs = {
        between: [start, end],
        "<": [start],
        ">": [end],
      }[dayOp];
      return this.set([
        dayOp,
        dayDim.mbql(),
        ...dayArgs.map(d => d.format(DATE_FORMAT)),
      ]);
    }
    return this;
  }

  /**
   * Returns the display name for the filter
   */
  displayName({
    includeDimension = true,
    includeOperator = true,
  }: FilterDisplayNameOpts = {}) {
    if (this.isSegment()) {
      const segment = this.segment();
      return segment ? segment.displayName() : t`Unknown Segment`;
    } else if (this.isStandard()) {
      if (isStartingFrom(this)) {
        includeOperator = false;
      }
      const betterDate = this.betterDateLabel();
      const op = betterDate ? "=" : this.operatorName();
      return [
        includeDimension && this.dimension()?.displayName(),
        includeOperator && this.operator(op)?.moreVerboseName,
        betterDate ?? this.formattedArguments().join(" "),
      ]
        .map(s => s || "")
        .join(" ");
    } else if (this.isCustom()) {
      return this._query.formatExpression(this);
    } else {
      return t`Unknown Filter`;
    }
  }

  /**
   * Returns true if the filter is valid
   */
  isValid() {
    if (this.isStandard()) {
      // has an operator name and dimension or expression
      const dimension = this.dimension().getMLv1CompatibleDimension();

      if (!dimension && isExpression(this[1])) {
        return true;
      }

      const query = this.query();

      if (
        !dimension ||
        !(query && query.filterDimensionOptions().hasDimension(dimension))
      ) {
        return false;
      }

      if (!this.operatorName()) {
        return false;
      }
      const operator = this.operator();

      if (operator) {
        const args = this.arguments();

        // has the minimum number of arguments
        if (args.length < operator.fields.length) {
          return false;
        }

        // arguments are non-null/undefined
        if (!_.all(args, arg => arg != null)) {
          return false;
        }
      }

      return true;
    } else if (this.isSegment()) {
      return !!this.segment();
    } else if (this.isCustom()) {
      return true;
    }

    return false;
  }

  // There are currently 3 "classes" of filters that are handled differently, "standard", "segment", and "custom"

  /**
   * Returns true if this is a "standard" filter
   */
  isStandard() {
    return isStandard(this);
  }

  /**
   * Returns true if this is a segment
   */
  isSegment() {
    return isSegment(this);
  }

  /**
   * Returns true if this is custom filter created with the expression editor
   */
  isCustom() {
    return isCustom(this);
  }

  /**
   * Returns true for filters where the first argument is a field
   */
  isFieldFilter() {
    return isFieldFilter(this);
  }

  // SEGMENT FILTERS
  segmentId() {
    if (this.isSegment()) {
      return this[1];
    }
  }

  segment() {
    if (this.isSegment()) {
      return this.metadata().segment(this.segmentId());
    }
  }

  // FIELD FILTERS
  dimension(): Dimension | null | undefined {
    if (this.isFieldFilter()) {
      return this._query.parseFieldReference(this[1]);
    }
    const field = getRelativeDatetimeField(this);
    if (field) {
      return this._query.parseFieldReference(field);
    }
  }

  field() {
    const dimension = this.dimension();
    return dimension && dimension.field();
  }

  operatorName() {
    return this[0];
  }

  operator(opName = this.operatorName()): FilterOperator | null | undefined {
    const dimension = this.dimension();
    return dimension ? dimension.filterOperator(opName) : null;
  }

  setOperator(operatorName: string) {
    const dimension = this.dimension();
    const operator = dimension && dimension.filterOperator(operatorName);
    const filter: FieldFilter = [operatorName, dimension && dimension.mbql()];

    if (operator) {
      for (let i = 0; i < operator.fields.length; i++) {
        if (operator.fields[i].default !== undefined) {
          filter.push(operator.fields[i].default);
        } else {
          filter.push(undefined);
        }
      }

      if (operator.optionsDefaults) {
        filter.push(operator.optionsDefaults);
      }

      const oldOperator = this.operator();
      const oldFilter = this;

      if (oldOperator) {
        // copy over values of the same type
        for (let i = 0; i < oldFilter.length - 2; i++) {
          const field = operator.multi
            ? operator.fields[0]
            : operator.fields[i];
          const oldField = oldOperator.multi
            ? oldOperator.fields[0]
            : oldOperator.fields[i];

          if (
            field &&
            oldField &&
            field.type === oldField.type &&
            oldFilter[i + 2] !== undefined
          ) {
            filter[i + 2] = oldFilter[i + 2];
          }
        }
      }
    }

    return this.set(filter);
  }

  setDimension(
    fieldRef: FieldReference | null | undefined,
    {
      useDefaultOperator = false,
    }: {
      useDefaultOperator?: boolean;
    } = {},
  ): Filter {
    if (!fieldRef) {
      return this.set([]);
    }

    const dimension = this._query.parseFieldReference(fieldRef);

    if (
      dimension &&
      (!this.isFieldFilter() || !dimension.isEqual(this.dimension()))
    ) {
      const operator = // see if the new dimension supports the existing operator
        dimension.filterOperator(this.operatorName()) || // otherwise use the default operator, if enabled
        (useDefaultOperator && dimension.defaultFilterOperator());
      const operatorName = operator && operator.name;
      const filter: Filter = this.set(
        this.isFieldFilter()
          ? [this[0], dimension.mbql(), ...this.slice(2)]
          : [null, dimension.mbql()],
      );

      if (operatorName && filter.operatorName() !== operatorName) {
        return filter.setOperator(operatorName);
      } else {
        return filter;
      }
    }

    return this;
  }

  setArgument(index: number, value: any) {
    return this.set([
      ...this.slice(0, index + 2),
      value,
      ...this.slice(index + 3),
    ]);
  }

  setArguments(values: any[]) {
    return this.set([...this.slice(0, 2), ...values]);
  }

  filterOperators(selected: string): FilterOperator[] | null | undefined {
    const dimension = this.dimension();
    return dimension ? dimension.filterOperators(selected) : null;
  }

  arguments() {
    return hasFilterOptions(this) ? this.slice(2, -1) : this.slice(2);
  }

  options() {
    return getFilterOptions(this);
  }

  setOptions(options: any) {
    return this.set(setFilterOptions(this, options));
  }

  formattedArguments(maxDisplayValues?: number = 1) {
    const dimension = this.dimension();
    const operator = this.operator();
    const args = this.arguments();

    if (operator && operator.multi && args.length > maxDisplayValues) {
      const n = args.length;
      return [ngettext(msgid`${n} selection`, `${n} selections`, n)];
    } else if (
      dimension &&
      dimension.field().isDate() &&
      !dimension.field().isTime()
    ) {
      return generateTimeFilterValuesDescriptions(this);
    } else {
      return args
        .map((value, index) => [
          value,
          getFilterArgumentFormatOptions(operator, index),
        ])
        .filter(([value, options]) => value !== undefined && !options.hide)
        .map(
          (
            [value, options],
            index, // FIXME: remapping
          ) => value, // <Value
          //   key={index}
          //   value={value}
          //   column={dimension.field()}
          //   remap
          //   {...options}
          // />
        );
    }
  }

  isDimension(otherDimension: Dimension) {
    const dimension = this.dimension();
    return dimension ? dimension.isEqual(otherDimension) : false;
  }

  isOperator(otherOperator: FilterOperator | string) {
    const operator = this.operator();
    const operatorName =
      typeof otherOperator === "string"
        ? otherOperator
        : otherOperator && otherOperator.name;
    return operator && operator.name === operatorName;
  }
}
