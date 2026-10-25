import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { emptyState, type Claim, type Item } from "../lib/types";
import {
  claimContext,
  claimStatusText,
  reportCorrespondence,
  validateResponse,
} from "../components/portal/studentExperience";
import { configuredDropoffs } from "../components/portal/studentDropoffs";
import { campus } from "../lib/campus";

const claim: Claim = {
  id: "claim-a",
  matchId: "match-a",
  claimantId: "student",
  answers: "Previous evidence",
  score: 0,
  status: "More information",
};
test("ownership responses enforce the server's trimmed minimum and raw maximum", () => {
  assert.ok(validateResponse("          "));
  assert.ok(validateResponse(" 123456789 "));
  assert.equal(validateResponse(" 1234567890 "), "");
  assert.equal(validateResponse("x".repeat(1500)), "");
  assert.ok(validateResponse("x".repeat(1501)));
});
test("claim context uses the owned lost report; report notes stay scoped and chronological", () => {
  const state = emptyState();
  state.items = [
    { id: "lost-a", name: "My bag", staffNotes: "DO NOT DISPLAY" } as Item,
    { id: "lost-b" } as Item,
  ];
  state.matches = [
    { id: "match-a", lostId: "lost-a", foundId: "private-found" } as any,
  ];
  assert.equal(claimContext(state, claim)?.id, "lost-a");
  assert.equal(
    claimContext(state, { ...claim, matchId: "missing" }),
    undefined,
  );
  const messages = [
    {
      id: "new",
      reportId: "lost-a",
      body: "Clarify the hidden marking",
      fromStaff: true,
      createdAt: "2026-10-24T11:00:00Z",
    },
    {
      id: "foreign",
      reportId: "lost-b",
      body: "UNRELATED PRIVATE NOTE",
      fromStaff: true,
      createdAt: "2026-10-24T10:00:00Z",
    },
    {
      id: "old",
      reportId: "lost-a",
      body: "Earlier note",
      fromStaff: false,
      createdAt: "2026-10-24T09:00:00Z",
    },
  ];
  assert.deepEqual(
    reportCorrespondence(messages, "lost-a").map((m) => m.id),
    ["old", "new"],
  );
  assert.equal(messages[0].id, "new");
});
test("all claim states have distinct truthful messages, including missing pickup pass", () => {
  for (const status of [
    "Pending",
    "More information",
    "Approved",
    "Rejected",
    "Returned",
  ] as const)
    assert.ok(claimStatusText({ ...claim, status }));
  assert.match(
    claimStatusText({ ...claim, status: "Pending" }),
    /received.*awaiting/,
  );
  assert.match(
    claimStatusText({ ...claim, status: "Approved" }),
    /no current pickup pass/,
  );
  assert.match(claimStatusText({ ...claim, status: "Returned" }), /closed/);
});
test("drop-off projection excludes ordinary buildings, inactive zones and extra private fields", async () => {
  const config = {
    ...campus,
    locations: [
      {
        id: "desk",
        name: "Sample campus desk",
        lat: 1,
        lng: 2,
        hours: "Weekdays",
        kind: "dropoff",
        staffNotes: "PRIVATE STORAGE",
      },
      {
        id: "building",
        name: "Not an intake desk",
        lat: 1,
        lng: 2,
        kind: "building",
      },
      {
        id: "inactive",
        name: "Closed desk",
        lat: 1,
        lng: 2,
        kind: "dropoff",
        active: false,
      },
    ],
  } as any;
  const result = await configuredDropoffs(config);
  assert.deepEqual(result, {
    source: "campus-config",
    zones: [
      {
        id: "desk",
        name: "Sample campus desk",
        instructions: "Weekdays",
        lat: 1,
        lng: 2,
      },
    ],
  });
  assert.deepEqual(
    (await configuredDropoffs({ ...config, locations: [] })).zones,
    [],
  );
});

// The repository test command selects react-server for API tests. Render client
// components in an ordinary React subprocess, with no backend or real user data.
function renderCheck(code: string) {
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
    import React from 'react'; globalThis.React = React;
    import { renderToStaticMarkup as render } from 'react-dom/server';
    import assert from 'node:assert/strict';
    import { OwnershipResponse } from './components/portal/StudentClaim.tsx';
    import ClaimModule from './components/portal/StudentClaim.tsx';
    const StudentClaim = ClaimModule.default || ClaimModule;
    import GuidanceModule, { DropoffContent } from './components/portal/StudentDropoffGuidance.tsx';
    const Guidance = GuidanceModule.default || GuidanceModule;
    const claim = ${JSON.stringify(claim)};
    ${code}
  `,
    ],
    { cwd: new URL("..", import.meta.url), stdio: "pipe" },
  );
}
test("rendered information request identifies claim/report and only renders owner-safe correspondence", () => {
  renderCheck(`
    const html = render(React.createElement(StudentClaim, {
      claim, report: {id:'lost-a', name:'My bag', status:'Awaiting Verification', staffNotes:'SECRET STAFF STORAGE'},
      messages: [
        {id:'a',reportId:'lost-a',body:'Describe the hidden marking',fromStaff:true,createdAt:'2026-10-24'},
        {id:'b',reportId:'foreign',body:'FOREIGN NOTE',fromStaff:true,createdAt:'2026-10-24'}],
      submit: async()=>{}, showPass:()=>{}
    }));
    for (const text of ['My bag','claim-a','Awaiting Verification','Describe the hidden marking','Submit private response','replaces your current claim answer','not linked to a specific claim']) assert.ok(html.includes(text), text);
    assert.ok(!html.includes('SECRET STAFF STORAGE'));
    assert.ok(!html.includes('FOREIGN NOTE'));
    assert.match(html, /minLength="10"/i); assert.match(html, /maxLength="1500"/i);
    assert.ok(!html.includes('<img'));
  `);
});
test("pending, closed and approved claims never offer response form; expired approval has no pass action", () => {
  renderCheck(`
    for (const status of ['Pending','Approved','Rejected','Returned']) {
      const html = render(React.createElement(StudentClaim, {claim:{...claim,status}, messages:[],submit:async()=>{},showPass:()=>{}}));
      assert.ok(!html.includes('<textarea')); assert.ok(!html.includes('View pickup pass'));
    }
    const html = render(React.createElement(StudentClaim, {claim:{...claim,status:'Approved',code:'sample'},messages:[],submit:async()=>{},showPass:()=>{}}));
    assert.ok(html.includes('View pickup pass'));
  `);
});
test("request without staff message provides clarification guidance", () => {
  renderCheck(`
    const html = render(React.createElement(StudentClaim, {claim,messages:[],submit:async()=>{},showPass:()=>{}}));
    assert.ok(html.includes('No detailed request')); assert.ok(html.includes('Submit private response'));
  `);
});
test("drop-off renders loading, error, empty and configured states and links to campus guidance", () => {
  renderCheck(`
    const view = (props) => render(React.createElement(DropoffContent, props));
    assert.match(view({loading:true,error:false,result:null}), /role="status"/);
    assert.match(view({loading:false,error:true,result:null}), /role="alert"/);
    assert.match(view({loading:false,error:false,result:{source:'approved-api',zones:[]}}), /No confirmed intake locations/);
    const html = view({loading:false,error:false,result:{source:'campus-config',zones:[{id:'a',name:'Sample desk',instructions:'Weekdays',lat:1,lng:2,staffNotes:'HIDDEN'}]}});
    assert.ok(html.includes('Live staff-managed intake locations are not available'));
    assert.ok(html.includes('Sample desk')); assert.ok(html.includes('query=1,2')); assert.ok(!html.includes('HIDDEN'));
    const compact = render(React.createElement(Guidance,{compact:true}));
    assert.ok(compact.includes('/student/map')); assert.ok(compact.includes('Students cannot submit found-item reports')); assert.ok(!compact.includes('<form'));
  `);
});
test("claim adapter submits to authorized claim API and never reports transport failure as success", () => {
  renderCheck(`
    const {submitClaim} = await import('./services/workspaceService.ts');
    const requests = []; let changes = 0;
    globalThis.window = {dispatchEvent:()=>{changes++;}};
    globalThis.fetch = async (path,options) => { requests.push({path,options}); return Response.json({ok:true},{status:201}); };
    await submitClaim('match-a','Additional private evidence');
    assert.equal(requests[0].path,'/api/claims/');
    assert.equal(requests[0].options.credentials,'same-origin');
    assert.deepEqual(JSON.parse(requests[0].options.body),{matchId:'match-a',answer:'Additional private evidence'});
    assert.equal(changes,1);
    globalThis.fetch = async()=>Response.json({error:'Unavailable'},{status:503});
    await assert.rejects(submitClaim('match-a','Evidence'),/Unavailable/);
    assert.equal(changes,1);
  `);
});

test("student navigation exposes all six routes and an accessible workspace loading state", () => {
  renderCheck(`
    const PortalModule = await import('./components/portal/Portal.tsx');
    const Portal = PortalModule.default.default || PortalModule.default;
    const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime.js');
    const html = render(React.createElement(AppRouterContext.Provider, {value:{push:()=>{},prefetch:()=>{}}}, React.createElement(Portal,{section:'updates'})));
    for (const route of ['overview','search','report','map','reports','updates']) assert.ok(html.includes('/student/'+route),route);
    assert.ok(html.includes('Student navigation')); assert.ok(html.includes('Loading your workspace'));
    assert.match(html, /aria-current="page"/); assert.ok(!html.includes('/student/found'));
  `);
});
