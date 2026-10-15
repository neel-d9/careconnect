import React from "react";
import {Link} from 'react-router-dom';
export function Card({children,className=''})
{
    return <section className={`card ${className}`}>{children}</section>
}
export function Stat({label,value,sub})
{
    return <Card className="stat">
            <span className="muted">{label}</span>
            <strong>{value}</strong>
            {sub&&<small>{sub}</small>}
            </Card>
}
export function Badge({children,tone='teal'})
{
    return <span className={`badge ${tone}`}>{children}</span>
}
export function Button({children,variant='primary',...p})
{
    return <button className={`btn ${variant}`} {...p}>{children}</button>
}
export function Table({columns,rows,empty='No records found.'})
{
    return  <div className="table-wrap">
                <table>
                    <thead>
                        <tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>{rows.map((r,i)=><tr key={r.id||i}>{columns.map(c=><td key={c.key}>{c.render?c.render(r):r[c.key]}</td>)}</tr>)}</tbody>
                </table>
            </div>
}
export function PageHeader({eyebrow,title,description,action})
{
    return <div className="page-header">
                <div>
                    <div className="eyebrow">{eyebrow}</div>
                    <h1>{title}</h1>{description&&<p>{description}</p>}
                </div>{action}
                </div>
}
export function LinkButton({to,children})
{
    return <Link className="btn primary" to={to}>{children}</Link>
}
