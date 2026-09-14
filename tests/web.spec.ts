import { test, expect, type Page } from '@playwright/test';
const origin='http://127.0.0.1:4317';
// The fixture is its own loopback proxy. Give independent test cases separate
// forwarded client addresses so normal login coverage does not trip brute-force limits.
test.beforeEach(async ({context}, info) => {
  const offset = {chromium:0,firefox:60,webkit:120}[info.project.name] ?? 0;
  await context.setExtraHTTPHeaders({'X-Forwarded-For':`192.0.2.${offset + info.line}`});
});
async function login(page:Page) {
  await page.goto('/');await page.getByLabel('Owner password').fill('browser-test-password');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  await expect(page.getByText('Connected · Shared on your home network')).toBeVisible();
  // The reserved scrollbar gutter is outside the HTML element's content box,
  // even when a short page does not yet need a scrollbar in Chromium.
  await expect.poll(() => page.locator('.layout').evaluate(el => Math.round(el.getBoundingClientRect().width) - Math.round(document.documentElement.getBoundingClientRect().width))).toBe(0);
}
test('login, shared edits, performance refresh, focus, narrow navigation, and browser reload',async({page,browser})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);
  const otherContext=await browser.newContext({baseURL:origin, extraHTTPHeaders:{'X-Forwarded-For':'192.0.2.250'}});const other=await otherContext.newPage();await login(other);
  await page.locator('.nav-item').filter({hasText:'Tasks'}).click();
  await other.locator('.nav-item').filter({hasText:'Tasks'}).click();
  await page.getByRole('button',{name:'+ Quick Add',exact:true}).click();
  const title=`Browser task ${Date.now()}`;
  await page.getByPlaceholder('What needs to be done?').fill(title);
  await page.locator('.modal .btn-primary').click();
  await expect(page.getByText(title,{exact:true})).toBeVisible();
  await other.bringToFront();
  await expect(other.getByText(title,{exact:true})).toBeVisible({timeout:6500});
  await other.locator('.nav-item').filter({hasText:'Performance'}).click();
  const task=(await (await page.request.get('/api/state')).json()).tasks.find((t:any)=>t.title===title);
  const renamed=title+' updated';
  await page.request.patch(`/api/tasks/${task.id}`,{headers:{origin},data:{title:renamed}});
  await expect(other.getByText(renamed,{exact:true}).first()).toBeVisible({timeout:6500});
  await page.reload();await expect(page.getByRole('heading',{name:'Today',exact:true})).toBeVisible();
  await page.getByTitle('Focus Mode',{exact:true}).click();await expect(page.getByTitle('Exit Focus')).toBeVisible();
  await page.getByTitle('Exit Focus').click();
  await page.setViewportSize({width:700,height:700});await page.getByLabel('Toggle navigation').click();
  await page.locator('.nav-item').filter({hasText:'Habits'}).click();await expect(page.getByRole('heading',{name:'Habits',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Sign out'}).click();await expect(page.getByLabel('Owner password')).toBeVisible();
  expect((await page.request.get('/api/state')).status()).toBe(401);
  expect(errors).toEqual([]);await otherContext.close();
});
test('failed saves preserve input and an expired session preserves the open form',async({page})=>{
  await login(page);await page.getByRole('button',{name:'+ Quick Add',exact:true}).click();
  const input=page.getByPlaceholder('What needs to be done?');await input.fill('Keep my unsaved draft');
  await page.route('**/api/tasks',route=>route.request().method()==='POST' ? route.abort('failed') : route.continue());
  await page.locator('.modal .btn-primary').click();await expect(input).toHaveValue('Keep my unsaved draft');
  await expect(page.locator('.modal').getByRole('alert')).toContainText('save could not be confirmed');
  await page.unroute('**/api/tasks');
  await page.context().clearCookies();
  await page.locator('.modal .btn-primary').click();await expect(page.getByLabel('Owner password')).toBeVisible();
  await page.getByLabel('Owner password').fill('browser-test-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(input).toBeVisible();await expect(input).toHaveValue('Keep my unsaved draft');
  await page.locator('.modal .btn-primary').click();await expect(input).not.toBeVisible();
});
test('offline startup shows a retry action',async({page})=>{
  await page.route('**/api/auth/session',route=>route.abort('failed'));
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('Cannot reach MyCoach');
  await page.unroute('**/api/auth/session');await page.getByRole('button',{name:'Retry connection'}).click();
  await expect(page.getByRole('alert')).not.toBeVisible();
});
