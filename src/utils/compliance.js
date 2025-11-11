import {
  addDays,
  differenceInMinutes,
  eachDayOfInterval,
  format,
  isAfter,
  isBefore,
  parseISO,
  subDays
} from 'date-fns';

const MAX_SHIFT_HOURS = 12;
const MIN_REST_HOURS = 12;
const MAX_WEEKLY_HOURS = 72;
const AMBER_THRESHOLD = 6; // hours before 72 to warn
const NIGHT_ALERT_THRESHOLD = 3;

function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function calculateShiftDuration(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) {
    return (24 * 60 - start + end) / 60;
  }
  return (end - start) / 60;
}

export function isNightShift(startTime, endTime) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) {
    return true;
  }
  const nightStart = 0;
  const nightEnd = 6 * 60;
  return start < nightEnd || end <= nightEnd;
}

function buildOccurrence(date, pattern) {
  const startDateTime = parseISO(`${date}T${pattern.startTime}`);
  let endDateTime = parseISO(`${date}T${pattern.endTime === '24:00' ? '23:59' : pattern.endTime}`);
  if (pattern.endTime === '24:00') {
    endDateTime = addDays(endDateTime, 1);
  } else if (pattern.endTime <= pattern.startTime) {
    endDateTime = addDays(endDateTime, 1);
  }

  const duration = calculateShiftDuration(pattern.startTime, pattern.endTime);
  return {
    date,
    startDateTime,
    endDateTime,
    duration,
    pattern
  };
}

export function expandAssignments({ assignments, shiftPatterns, teams }) {
  const patternMap = new Map(shiftPatterns.map((pattern) => [pattern.id, pattern]));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  return assignments.flatMap((assignment) => {
    const pattern = patternMap.get(assignment.shiftPatternId);
    if (!pattern) return [];

    const days = eachDayOfInterval({
      start: parseISO(assignment.startDate),
      end: parseISO(assignment.endDate)
    });

    const people = assignment.assigneeType === 'team'
      ? (teamMap.get(assignment.assigneeId)?.members ?? [])
      : [assignment.assigneeId];

    return people.flatMap((personId) => (
      days.map((day) => {
        const date = format(day, 'yyyy-MM-dd');
        const occurrence = buildOccurrence(date, pattern);
        return {
          ...occurrence,
          personId,
          assignmentId: assignment.id,
          projectId: assignment.projectId,
          assigneeType: assignment.assigneeType,
          assigneeId: assignment.assigneeId
        };
      })
    ));
  });
}

function rollingWindowHours(entries, index) {
  const current = entries[index];
  const windowStart = subDays(current.startDateTime, 6);
  return entries.reduce((total, entry, entryIndex) => {
    if (entryIndex > index) return total;
    if (isAfter(entry.startDateTime, current.startDateTime)) return total;
    if (isBefore(entry.startDateTime, windowStart)) return total;
    return total + entry.duration;
  }, 0);
}

function formatRange(start, end) {
  const startStr = format(start, 'dd MMM');
  const endStr = format(end, 'dd MMM');
  return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
}

export function computeCompliance({ assignments, shiftPatterns, teams }) {
  const occurrences = expandAssignments({ assignments, shiftPatterns, teams });
  const personMap = new Map();

  occurrences.forEach((occurrence) => {
    const { personId } = occurrence;
    if (!personMap.has(personId)) {
      personMap.set(personId, []);
    }
    personMap.get(personId).push(occurrence);
  });

  const compliance = new Map();

  personMap.forEach((entries, personId) => {
    const sorted = entries.sort((a, b) => a.startDateTime.getTime() - b.startDateTime.getTime());
    const breaches = [];
    const approaching = [];
    let consecutiveNights = 0;

    sorted.forEach((entry, index) => {
      if (entry.duration > MAX_SHIFT_HOURS) {
        breaches.push({
          type: 'shift-length',
          label: 'Shift longer than 12 hours',
          dateRange: formatRange(entry.startDateTime, entry.endDateTime),
          magnitude: `${(entry.duration - MAX_SHIFT_HOURS).toFixed(1)}h over`,
          projectId: entry.projectId
        });
      }

      if (index > 0) {
        const prev = sorted[index - 1];
        const restMinutes = differenceInMinutes(entry.startDateTime, prev.endDateTime);
        const restHours = restMinutes / 60;
        if (restHours < MIN_REST_HOURS) {
          breaches.push({
            type: 'rest',
            label: 'Rest period below 12 hours',
            dateRange: formatRange(prev.endDateTime, entry.startDateTime),
            magnitude: `${(MIN_REST_HOURS - restHours).toFixed(1)}h short`,
            projectId: entry.projectId
          });
        }
      }

      const windowHours = rollingWindowHours(sorted, index);
      if (windowHours > MAX_WEEKLY_HOURS) {
        breaches.push({
          type: 'weekly-hours',
          label: 'Over 72h in rolling 7 days',
          dateRange: formatRange(subDays(entry.startDateTime, 6), entry.endDateTime),
          magnitude: `${(windowHours - MAX_WEEKLY_HOURS).toFixed(1)}h over`,
          projectId: entry.projectId
        });
      } else if (windowHours > MAX_WEEKLY_HOURS - AMBER_THRESHOLD) {
        approaching.push({
          type: 'weekly-hours',
          label: 'Approaching 72h limit',
          dateRange: formatRange(subDays(entry.startDateTime, 6), entry.endDateTime),
          magnitude: `${(MAX_WEEKLY_HOURS - windowHours).toFixed(1)}h spare`,
          projectId: entry.projectId
        });
      }

      const night = isNightShift(entry.pattern.startTime, entry.pattern.endTime);
      if (night) {
        consecutiveNights += 1;
        if (consecutiveNights >= NIGHT_ALERT_THRESHOLD) {
          approaching.push({
            type: 'night-shift',
            label: 'Multiple consecutive night shifts',
            dateRange: formatRange(sorted[Math.max(0, index - consecutiveNights + 1)].startDateTime, entry.endDateTime),
            magnitude: `${consecutiveNights} nights`,
            projectId: entry.projectId
          });
        }
      } else {
        consecutiveNights = 0;
      }
    });

    const status = breaches.length > 0
      ? 'red'
      : approaching.length > 0
        ? 'amber'
        : 'green';

    const totalHours = sorted.reduce((acc, entry) => acc + entry.duration, 0);

    compliance.set(personId, {
      personId,
      entries: sorted,
      breaches,
      approaching,
      status,
      totalHours
    });
  });

  return compliance;
}

export function getPersonCompliance(personId, complianceMap) {
  return complianceMap.get(personId) ?? {
    personId,
    entries: [],
    breaches: [],
    approaching: [],
    status: 'green',
    totalHours: 0
  };
}

export function groupAssignmentsByProject(assignments) {
  return assignments.reduce((acc, assignment) => {
    if (!acc.has(assignment.projectId)) {
      acc.set(assignment.projectId, []);
    }
    acc.get(assignment.projectId).push(assignment);
    return acc;
  }, new Map());
}

export function summarizeProject(assignments, shiftPatterns, teams) {
  const expanded = expandAssignments({ assignments, shiftPatterns, teams });
  const totalHours = expanded.reduce((acc, entry) => acc + entry.duration, 0);
  const uniquePeople = new Set(expanded.map((entry) => entry.personId));
  const hoursByPattern = expanded.reduce((acc, entry) => {
    const key = entry.pattern.name;
    acc[key] = (acc[key] ?? 0) + entry.duration;
    return acc;
  }, {});

  return {
    totalHours,
    peopleCount: uniquePeople.size,
    hoursByPattern
  };
}
